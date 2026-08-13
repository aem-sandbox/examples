/**
 * Exchanges an Adobe Developer Console "OAuth Server-to-Server" credential
 * (Client ID + Client Secret) for a bearer access token.
 *
 * The resulting token can be used for BOTH:
 *  - admin.da.live  (Document Authoring admin API)
 *  - admin.hlx.page (AEM Edge Delivery Services admin API)
 *
 * ...as long as the credential's technical account email has been added to
 * both DA Permissions and EDS Users for the relevant org/site.
 *
 * Required scopes for the "Edge Delivery Services" API card:
 *   openid,AdobeID,aem.frontend.all,additional_info.projectedProductContext,read_organizations
 *
 * Usage:
 *   CLIENT_ID=... CLIENT_SECRET=... node examples/how-to-edge-delivery-services-api-card/get-token.mjs
 */

const IMS_TOKEN_URL = 'https://ims-na1.adobelogin.com/ims/token/v3';
const DEFAULT_SCOPE = 'openid,AdobeID,aem.frontend.all,additional_info.projectedProductContext,read_organizations';

export async function getAccessToken({
  clientId = process.env.CLIENT_ID,
  clientSecret = process.env.CLIENT_SECRET,
  scope = DEFAULT_SCOPE,
} = {}) {
  if (!clientId || !clientSecret) {
    throw new Error('CLIENT_ID and CLIENT_SECRET are required (env vars or function args).');
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope,
  });

  const res = await fetch(IMS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    throw new Error(`Failed to obtain access token: ${res.status} ${await res.text()}`);
  }

  const { access_token, expires_in } = await res.json();
  return { accessToken: access_token, expiresIn: expires_in };
}

// Allow running directly: `node get-token.mjs` prints the token to stdout,
// so it can be captured by a calling shell / GitHub Actions step.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { accessToken } = await getAccessToken();
  console.log(accessToken);
}
