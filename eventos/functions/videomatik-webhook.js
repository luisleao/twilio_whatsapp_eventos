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
    const { state, id, videoRequestId, participanteId, downloadURL, from } = event;

    await firestore.collection('videomatik').doc(id).set({
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        videoRequestId,
        state
    }, { merge: true });

    const participante = await firestore.collection('participantes').doc(participanteId).get().then(p => {
        return p.data();
    })

    
    console.log('resultado participante', participante);

    switch(state) {
        case 'render':
        case 'rendering':
            await client.messages.create({
                from: `whatsapp:${from}`, //`whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER_DEFAULT}`,
                to: `whatsapp:${participante.phoneNumber}`,
                body: 'Seu vídeo está sendo renderizado agora.'
                // body: 'Your video is rendering now.'
            }).then(m => {
                console.log('RENDER', m.sid);
            });
            break;

        case 'finished':

            // Carregar participante
            await firestore.collection('videomatik').doc(id).set({
                downloadURL
            }, { merge: true });
        

            // Carregar dados do vídeo
            // const videoRequest = await videomatik.getOneVideoRequest(videoRequestId);
            // console.log(videoRequest.renderJob);

            
            // let mensagem = [];
            // mensagem.push(`Este vídeo foi feito pela API da Videomatik.`);
            // // mensagem.push(`Você sabia que a Videomatik está sorteando uma Alexa Echo Dot para quem testar a API de criar vídeos? Passe no estande e saiba mais!`);
            // mensagem.push(``);
            // mensagem.push(`Confira e favorite o repositório https://github.com/luisleao/twilio_whatsapp_eventos para ter acesso ao código-fonte!`);

            // // mensagem.push(`This video was made by Videomatik API together with Twilio's WhatsApp API.`);
            // // mensagem.push(``);
            // // mensagem.push(`If you want to see the code, check out and bookmark this repository: https://github.com/luisleao/twilio_whatsapp_eventos`);

            
            // // Envio da mensagem de agradecimento
            // await client.messages.create({
            //     from: `whatsapp:${from}`, //`whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER_DEFAULT}`,
            //     to: `whatsapp:${participante.phoneNumber}`,
            //     body: mensagem.join('\n\n')
            // });
            
            // Envio do video
            await client.messages.create({
                from: `whatsapp:${from}`, //`whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER_DEFAULT}`,
                to: `whatsapp:${participante.phoneNumber}`,
                // body: 'Here is your video',
                body: 'Aqui está seu vídeo!',
                mediaUrl: downloadURL //videoRequest.renderJob.downloadURL //`https://leao.ngrok.io/gateway?video=${videoRequest.renderJob.downloadURL}`
            }).then(m => {
                console.log('FINISHED', m.sid);
            });


            // Contador Videomatik
            try {
                const axios = require('axios').default;
                await axios.get('https://video-counter.vercel.app/api/increment');
            } catch (e) {
                console.log('Axios error');
            }

            // Adicionar pontos
            // TODO: add points caso não tenha gerado vídeo ainda
            
            break;
  
    }

    return callback(null, 'OK');
};