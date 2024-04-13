import { WorkerContext } from './worker';

export async function sendToTelegramBot(wc: WorkerContext, message: string) {
	const TELEGRAM_BOT_URL = `https://api.telegram.org/bot${wc.env.TELEGRAM_BOT_TOKEN}`;
	const response = await fetch(`${TELEGRAM_BOT_URL}/sendMessage`, {
	  method: 'POST',
	  headers: {
		  'Content-Type': 'application/json',
	  },
	  body: JSON.stringify({
      chat_id: wc.env.TELEGRAM_CHAT_ID,
      text: message, 
      parse_mode: "HTML"
	  }),
	});
	const responseData = await response.json();

	if (!response.ok) {
	  throw new Error(`Failed to send message to Telegram: ${JSON.stringify(responseData, null, 2)}`);
	}
  return responseData;
}