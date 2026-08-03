# Shared DA/EDS access token

This directory contains a small helper script, `get-token.mjs`, that exchanges
an Adobe Developer Console "OAuth Server-to-Server" credential (Client ID +
Client Secret) for a bearer access token. The resulting token can be used to
call **both** the Document Authoring admin API (`admin.da.live`) and the AEM
Edge Delivery Services admin API (`admin.hlx.page`), provided the credential's
technical account email has been added to DA Permissions and EDS Users for
the relevant org/site. This lets automation use a single token instead of
maintaining two separate credentials.

## Setup

1. In the [Adobe Developer Console](https://developer.adobe.com/console),
   create (or reuse) a project that has the **Edge Delivery Services** API
   card added, with an **OAuth Server-to-Server** credential generated.
2. Add the credential's Client ID and Client Secret as GitHub Actions
   repository secrets, for example:
   - `AEM_S2S_CLIENT_ID`
   - `AEM_S2S_CLIENT_SECRET`
3. Make sure the credential's technical account email has been added to both
   DA Permissions and EDS Users before using the token (see the companion
   "How to use AEM Edge Delivery Services API Card" doc for details).

## GitHub Actions usage

```yaml
- name: Get shared DA/EDS access token
  id: token
  env:
    CLIENT_ID: ${{ secrets.AEM_S2S_CLIENT_ID }}
    CLIENT_SECRET: ${{ secrets.AEM_S2S_CLIENT_SECRET }}
  run: |
    TOKEN=$(node scripts/shared-token-da-eds/get-token.mjs)
    echo "::add-mask::$TOKEN"
    echo "token=$TOKEN" >> "$GITHUB_OUTPUT"

- name: Call admin.da.live
  run: |
    curl -X GET '<https://admin.da.live/source/ORG/SITE/PATH.html>' \
      --header "Authorization: Bearer ${{ steps.token.outputs.token }}"

- name: Publish via admin.hlx.page
  run: |
    curl --request POST \
      --url '<https://admin.hlx.page/live/ORG/SITE/main/PATH>' \
      --header "Authorization: Bearer ${{ steps.token.outputs.token }}" \
      --header "x-content-source-authorization: Bearer ${{ steps.token.outputs.token }}"
```

## Reminder

Before this token will work against DA and EDS, the OAuth Server-to-Server
credential's technical account email must be added to **both**:

- DA Permissions (for the relevant org/site in DA)
- EDS Users (in the site's config), with an appropriate role such as
  `basic_publish` or `publish`

If you'd rather not consolidate onto a single credential, you can continue
using a separate API key for HLX/EDS and this service token only for DA.
