 - npm install
 - wrangler login
 - npm run watch
 - npm run deploy
 - wrangler secret put <KEY>

Add local secrets to .dev.vars, put secrets to cloudflare

When using node modules such as Buffer, import as node:buffer.


This project works (somewhat) but was abandoned for two reasons:
- Cloudflare support for Node is very limited and requires going through a bunch of hoops to get it to work. Like webpack, etc.
- Cloudflare has a hard limit of 30 seconds for workers

Azure was first explored as an alternative due to the long run times allowed, seemingly simple setup and seemingly simple UI dashboard, but AWS was selected as the final lambda provider due to the comprehensive documentation available and specific error messages.

The newer version of this copy trader still uses Cloudflare, but only as the front-end for authenticating and capturing Helius events which are then forwarded to an AWS lambda for final processing, see aws-sam-solana-bot and solana-bot-webhook-handler-dd07.
