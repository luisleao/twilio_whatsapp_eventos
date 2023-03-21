const admin = require('firebase-admin');
process.env.GOOGLE_APPLICATION_CREDENTIALS = Runtime.getAssets()['/firebase-credentials.json'].path;
const { escondeNumero, limpaNumero, getDDD, sendNotification, convertNewLine, fillParams } = require(Runtime.getFunctions()['util'].path);

if (!admin.apps.length) {
  admin.initializeApp({}); 
} else {
  admin.app();
}
const firestore = admin.firestore();
const md5 = require('md5');

const AGENDAMENTO_ATIVADO = false;


/*
    event: from
*/
exports.handler = async function(context, event, callback) {
    const participanteId = await md5(limpaNumero(event.from));
    const idPlayerEvent = await md5(`${event.evento}:${limpaNumero(event.from)}`);

    const { WHATSAPP_MESSAGE_SERVICE_SID, WHATSAPP_ONBOARDING_TDC_TEMPLATE_CIDADE_SID, ACCOUNT_SID, AUTH_TOKEN } = process.env;
    // const client = context.getTwilioClient();
    const client = require('twilio')(ACCOUNT_SID, AUTH_TOKEN);

    // Enviar mensagem Content API com cidades
    console.log('MESSAGE', {
        contentSid: WHATSAPP_ONBOARDING_TDC_TEMPLATE_CIDADE_SID,
        messagingServiceSid: WHATSAPP_MESSAGE_SERVICE_SID, 
        to: event.from, //`whatsapp:${participante.phoneNumber}`,
        // ContentVariables: {}
    });
    await client.messages.create({
        contentSid: WHATSAPP_ONBOARDING_TDC_TEMPLATE_CIDADE_SID,
        messagingServiceSid: WHATSAPP_MESSAGE_SERVICE_SID, 
        to: event.from, //`whatsapp:${participante.phoneNumber}`,
        // ContentVariables: {}
    }).then(m => {
        console.log('SENT CONTENT MESSAGE', m.sid);
        callback(null, m.sid);
    }).catch(e => {
        callback(e, null);
    });


};
