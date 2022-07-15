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
    // TODO: adicionar firebase
    console.log('event videomatik ', event);

    let participanteId = await md5(limpaNumero(event.from));

    let registroId = await firestore.collection('videomatik').add({
        participanteId,
        imagem: event.imagem,
        state: 'new',
        participanteId: participanteId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    }).then(c => {
        return c.id;
    });



    
    // TODO: chamada videomatik
    console.log('REGISTRO ADICIONADO', registroId);
    const customJSON = {
        "soundtrack": {
        "startTime": 0,
        "source": ""
        },
        "images": [
        {
            "path": "assets[0]",
            "source": event.imagem
        },
        {
            "path": "assets[1]",
            "source": "https://storage.videomatik.com.br/videomatik/templates/front-in-sampa-participantes/assets/Front in sampa background.mp4"
        },
        {
            "path": "assets[2]",
            "source": "aud_0.mp3"
        }
        ],
        "version": "1",
        "texts": [
        {
            "fillColor": "#ffffff",
            "fontStyle": "Medium",
            "path": "assets[3].layers[0].t.d.k[0]",
            "fontWeight": "500",
            "fontAscent": 75,
            "hidden": null,
            "time": 0,
            "fontSize": 64,
            "value": "O maior evento front end",
            "justification": "RIGHT",
            "fontFamily": "Roboto",
            "fontName": "Roboto-Medium",
            "lineHeight": 76.8000030517578
        },
        {
            "fillColor": "#ffffff",
            "fontStyle": "Medium",
            "path": "assets[3].layers[1].t.d.k[0]",
            "fontWeight": "500",
            "fontAscent": 75,
            "hidden": null,
            "time": 0,
            "fontSize": 64,
            "value": "da America Latina",
            "justification": "RIGHT",
            "fontFamily": "Roboto",
            "fontName": "Roboto-Medium",
            "lineHeight": 76.8000030517578
        },
        {
            "fillColor": "#46d733",
            "fontStyle": "Black",
            "path": "assets[3].layers[2].t.d.k[0]",
            "fontWeight": "900",
            "fontAscent": 75,
            "hidden": null,
            "time": 0,
            "fontSize": 115,
            "value": "Eu fui!",
            "justification": "CENTER",
            "fontFamily": "Roboto",
            "fontName": "Roboto-Black",
            "lineHeight": 138
        }
        ],
        "shapes": [
        {
            "path": "assets[3].layers[3].shapes[0].it[1]",
            "color": "#5e17eb"
        },
        {
            "path": "assets[3].layers[4].shapes[0].it[1]",
            "color": "#5e17eb"
        },
        {
            "path": "assets[3].layers[5].shapes[0].it[1]",
            "color": "#ffffff"
        },
        {
            "path": "assets[3].layers[6].shapes[0].it[1]",
            "color": "#46d733"
        },
        {
            "path": "assets[3].layers[8].shapes[0].it[1]",
            "color": "#46d733"
        }
        ]
    }

    const videoRequest = await videomatik.createVideoRequest({
        templateId: 'front-in-sampa-participantes', // <- ID do Template
        customJSON,
        compositionId: 'default', // <- Vertical
        actions: [

            // Você pode colocar um Webhook para ser notificado quando o vídeo ficar pronto
            {
                type: 'webhook',
                url: process.env.VIDEOMATIK_CALLBACK_URL.split('{{id}}').join(registroId).split('{{participanteId}}').join(participanteId),
            },
        ],
    }).catch(e => {
        console.log('VIDEOMATIK ERRO:', e);
        callback(null, {
            erro: true,
            mensagem: convertNewLine(event.mensagemErro)
        });
        return null;
    });

    console.log('videoRequest', videoRequest);


    return callback(null, {
        erro: false,
        mensagem: convertNewLine(event.mensagemSucesso)
    });

};