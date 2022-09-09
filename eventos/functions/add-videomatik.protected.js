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

const VIDEOMATIK_ESTADOS_TRAVAR = [
  'new',
  'render'
]

// parâmetros: imagem, from
exports.handler = async function(context, event, callback) {
    // adicionar firebase
    console.log('event videomatik ', event);

    let participanteId = await md5(limpaNumero(event.from));

    // TODO: verificar se tem vídeo com status 'new' ou outro
    let participante = await firestore.collection('participantes')
      .doc(participanteId).get().then(p => p.data());

    

    let videosPendentes = await firestore.collection('videomatik')
      .where('participanteId', '==', participanteId)
      .where('state', 'in', VIDEOMATIK_ESTADOS_TRAVAR)
      .get()
      .then(list => {
        return list.size
      });
    
    console.log('VIDEO PENDENTES', videosPendentes);

    let mensagem = [];

    if (videosPendentes > 0 && !participante.videomatikUnlimited) {
      mensagem.push('Você ainda tem um vídeo em processo de renderização.');
      mensagem.push('Aguarde a finalização dele para solicitar um novo!');

      callback(null, {
        erro: true,
        mensagem: mensagem.join('\n\n')
      });
    }


    let registroId = await firestore.collection('videomatik').add({
        participanteId,
        imagem: event.imagem,
        state: 'new',
        participanteId: participanteId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    }).then(c => {
        return c.id;
    });

    // Registrar participante na base geral
    await firestore.collection('participantes')
    .doc(participanteId).set({
        phoneNumber: limpaNumero(event.from),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        videomatik: admin.firestore.FieldValue.increment(1)
    }, { merge: true });


    await firestore.collection('events')
    .doc(event.evento).collection('participantes')
    .doc(participanteId).set({
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      videomatik: admin.firestore.FieldValue.increment(1)
    }, { merge: true });


    // Chamada para incluir vídeo na Videomatik
    console.log('REGISTRO ADICIONADO', registroId);
    const customJSONV1 = {
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
    };

    const customJSONFrontin = {
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
            "source": "https://storage.videomatik.com.br/videomatik/templates/front-in-sampa-participantes-v2/assets/Front in sampa background.mp4"
          },
          {
            "path": "assets[2]",
            "source": "https://storage.videomatik.com.br/videomatik/templates/front-in-sampa-participantes-v2/assets/frontin sampa 2022 - eu fui (2).mp3"
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
            "path": "assets[3].layers[7].shapes[0].it[1]",
            "color": "#46d733"
          },
          {
            "path": "assets[3].layers[9].shapes[0].it[1]",
            "color": "#46d733"
          }
        ]
    };

    const customJSON = {
      "soundtrack": {
        "startTime": 0,
        "source": ""
      },
      "images": [
        {
          "path": "assets[0]",
          "source": event.imagem
        }
      ],
      "version": "1",
      "texts": [],
      "shapes": []
    }

    const videoRequest = await videomatik.createVideoRequest({
        templateId: 'eu-fui-no-tdc-business', //'front-in-sampa-participantes', // <- ID do Template
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