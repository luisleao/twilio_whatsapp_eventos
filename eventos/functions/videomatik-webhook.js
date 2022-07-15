const admin = require('firebase-admin');
process.env.GOOGLE_APPLICATION_CREDENTIALS = Runtime.getAssets()['/firebase-credentials.json'].path;
const { escondeNumero, limpaNumero, getDDD, convertNewLine } = require(Runtime.getFunctions()['util'].path);


if (!admin.apps.length) {
    admin.initializeApp({}); 
} else {
    admin.app();
}

const VideomatikAPI = require('@videomatik/api');
const videomatik = new VideomatikAPI({
    apiKey: process.env.VIDEOMATIK_API_KEY,
});
  

const firestore = admin.firestore();
const md5 = require('md5');

// parâmetros: imagem, from
exports.handler = async function(context, event, callback) {
    const client = context.getTwilioClient();

    console.log('VIDEOMATIK EVENT', event);
    const { state, id, videoRequestId, participanteId, downloadURL } = event;

    await firestore.collection('videomatik').doc(id).set({
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        videoRequestId,
        state
        // TODO: incluir demais dados
    }, { merge: true });

    const participante = await firestore.collection('participantes').doc(participanteId).get().then(p => {
        return p.data();
    })
    console.log('resultado participante', participante);

    switch(state) {
        case 'render':
            await client.messages.create({
                from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
                to: `whatsapp:${participante.phoneNumber}`,
                body: 'Seu vídeo está sendo renderizado agora.'
            }).then(m => {
                console.log('RENDER', m.sid);
            });
            break;

        case 'finished':

            // Carregar participante
            await firestore.collection('videomatik').doc(id).set({
                downloadURL
                // TODO: incluir demais dados
            }, { merge: true });
        


            // const videoRequest = await videomatik.getOneVideoRequest(videoRequestId);
            // console.log(videoRequest.renderJob);

            await client.messages.create({
                from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
                to: `whatsapp:${participante.phoneNumber}`,
                body: 'Seu vídeo foi gerado com sucesso e você receberá ele em alguns instantes!\n\nQuer saber como desenvolvemos este serviço? Confira o código-fonte em https://github.com/luisleao/twilio_whatsapp_eventos'
            });

            await client.messages.create({
                from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
                to: `whatsapp:${participante.phoneNumber}`,
                body: 'Aqui está seu vídeo',
                mediaUrl: downloadURL //videoRequest.renderJob.downloadURL //`https://leao.ngrok.io/gateway?video=${videoRequest.renderJob.downloadURL}`
            }).then(m => {
                console.log('FINISHED', m.sid);
            });
            break;
  
    }

    return callback(null, 'OK');
};