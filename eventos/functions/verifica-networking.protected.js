const admin = require('firebase-admin');
process.env.GOOGLE_APPLICATION_CREDENTIALS = Runtime.getAssets()['/firebase-credentials.json'].path;
const { escondeNumero, limpaNumero, getDDD, sendNotification } = require(Runtime.getFunctions()['util'].path);

if (!admin.apps.length) {
    admin.initializeApp({});
} else {
    admin.app();
}
const firestore = admin.firestore();
const md5 = require('md5');


const MENSAGEM_CONEXAO = 'Aqui está o LinkedIn da pessoa que você escaneou: {{1}}\n\n';
const MENSAGEM_CONECTADO = 'Uma nova pessoa que acabou de se conectar com você: {{1}}\n\n';



exports.handler = async function(context, event, callback) {
    const client = await context.getTwilioClient();

    console.log('NETWORKING', event);

    let participanteId = await md5(limpaNumero(event.from));
    let networkedId = event.token.toLowerCase();

    if (participanteId.toLowerCase() == event.token.toLowerCase()) {
        return callback(null, {
            retornaEvento: false,
            mensagem: '✋ Atenção ✋\n\nVocê está informando seu próprio registro! 😉'
        });
    }


    const participante = await firestore.collection('participantes').doc(participanteId).get();

    // Verificar se participante existe
    if (!participante.exists) {
        return callback(null, {
            retornaEvento: true,
            mensagem: '✋ Atenção ✋\n\nVocê ainda não fez o no evento para poder receber o LinkedIn da pessoa informada.'
        });
    }

    // Verificar se participante possui LinkedIn
    const participanteData = participante.data();
    if (!participanteData.linkedin) {
        return callback(null, {
            retornaEvento: true,
            mensagem: '✋ Atenção ✋\n\nAinda não informou seu LinkedIn para participar.\n\nÉ necessário fazer seu registro no evento.'
        });
    }

    // Verificar se conexão informada existe na tabela de participantes
    const participanteConectado = await firestore.collection('participantes').doc(networkedId).get();
    if (!participante.exists) {
        return callback(null, {
            retornaEvento: false,
            mensagem: '✋ Atenção ✋\n\nIdentificador de participante informado não foi encontrado.'
        });
    }

    // Verificar se conexão informada possui LinkedIn
    const participanteConectadoData = participanteConectado.data();
    if (!participanteConectadoData.linkedin) {
        return callback(null, {
            retornaEvento: false,
            mensagem: '✋ Atenção ✋\n\nIdentificador de participante informado não possui LinkedIn vinculado.'
        });
    }


    let pointsToGive = 0;
    let pointsToReceive = 0;

    // Montar mensagem base para quem informou o codigo
    let networkedProfile = ['\n'];
    if (participanteConectadoData.nome) networkedProfile.push(`*${participanteConectadoData.nome}*`);
    if (participanteConectadoData.linkedin) networkedProfile.push(`*${participanteConectadoData.linkedin}*`);
    let participanteMensagem = MENSAGEM_CONEXAO.split('{{1}}').join(networkedProfile.join('\n'));

    // Montar mensagem base para conexão informada
    let participanteProfile = ['\n'];
    if (participanteData.nome) participanteProfile.push(`*${participanteData.nome}*`);
    if (participanteData.linkedin) participanteProfile.push(`*${participanteData.linkedin}*`);
    let networkedMensagem = MENSAGEM_CONECTADO.split('{{1}}').join(participanteProfile.join('\n'));


    // Verificar se networking já foi realizado entre as pessoas
    const networked = await firestore.collection('events').doc(event.evento).collection('networking')
        .where('connection', 'in', [`${participanteId}_${networkedId}`, `${networkedId}_${participanteId}`])
        .get()
        .then(s => {
            return s.size > 0
        });


    if (!networked) {
        // Incluir registro de networking no evento
        await firestore.collection('events').doc(event.evento).collection('networking').add({
            connection: `${participanteId}_${networkedId}`,
            participanteId: participanteId,
            networkedId: networkedId,
            evento: event.evento,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            pointsToGive,
            pointsToReceive
        });

        // Registrar contador de networking
        await firestore.collection('events').doc(event.evento).collection('participantes')
        .doc(participanteId).set({
            networking: admin.firestore.FieldValue.increment(1),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // TODO: carregar pontuação padrão do evento
        // TODO: carregar pontuação manual do participante e da conexão
        // TODO: Registrar pontuação

        
        // Adicionar mensagem de pontuação se for o caso
        if (pointsToReceive > 0) {
            participanteMensagem += `Você ganhou *${pointsToReceive} ponto${pointsToReceive > 1 ? 's' : ''}*.\n`;
            networkedMensagem += `A pessoa ganhou *${pointsToReceive} ponto${pointsToReceive > 1 ? 's' : ''}*.\n`;
        }
        if (pointsToGive > 0) {
            participanteMensagem += `A pessoa ganhou *${pointsToGive} ponto${pointsToGive > 1 ? 's' : ''}*.\n`;
            networkedMensagem += `Você ganhou *${pointsToGive} ponto${pointsToGive > 1 ? 's' : ''}*.\n`;
        }

    }

    

    // Enviar mensagem para a conexão informada
    await sendNotification(
        client,
        event.to,
        `whatsapp:${participanteConectadoData.phoneNumber}`,
        networkedMensagem
    );

    return callback(null, {
        retornaEvento: false,
        mensagem: participanteMensagem
    });




    // const currentEvent = participantData.last_network || 'ahoy';

    // console.log('participant.exists', participantData);

    // const activationEvent = await firestore.collection('activations').doc(currentEvent).get();
    // const activationEventData = activationEvent.data();


    // console.log('activationEventData', activationEventData);



    // const networked = await firestore.collection('networking').doc(currentEvent).collection('participants').doc(event.token).get();
    // if (networked.exists) {
    //   console.log('networked.exists')

    //   const networkedData = networked.data();

    //   // verificar se já pontuou um ao outro

    //   // /score/tdcinnovation2022/attendants/[participanteId]/tokens/network_[networkedId]
    //   console.log('AWAIT DO SCORE 1');
    //   if ((await firestore.collection('score')
    //     .doc(currentEvent)
    //     .collection('attendants')
    //     .doc(event.token)
    //     .collection('tokens')
    //     .doc(`networking_${participanteId}`)
    //     .get()).exists){
    //       return callback(null, {
    //         type: 'networking-scan',
    //         message: '✋ Atenção ✋\n\nJá existe um registro de networking entre a pessoa informada e você.'
    //       });
    //     }

    //   console.log('AWAIT DO SCORE 2');

    //   // /score/tdcinnovation2022/attendants/[networkedId]/tokens/network_[participanteId]
    //   if ((await firestore.collection('score')
    //     .doc(currentEvent)
    //     .collection('attendants')
    //     .doc(participanteId)
    //     .collection('tokens')
    //     .doc(`networking_${event.token}`)
    //     .get()).exists){
    //       return callback(null, {
    //         type: 'networking-scan',
    //         message: '✋ Atenção ✋\n\nJá existe um registro de networking entre você e a pessoa informada.'
    //       });
    //     }




    //   // TODO: gerar pontos conforme regra

    //   // quando alguém me escaneia, a pessoa recebe X pontos
    //   // quando alguém me escaneia, eu recebo X pontos
    //   // quando eu escaneio, a pessoa recebe X pontos
    //   // quando eu escaneio, eu recebo x pontos

    //   let pointsToGive = 0;
    //   let pointsToReceive = 0;

    //   if (activationEventData.usePoints) {

    //     if (!participantData.dontReceivePoints) {
    //       pointsToReceive = 1;
    //     }
    //     if (
    //       (networkedData.pointsToGive && networkedData.pointsToGive > 0)
    //       && !participantData.dontReceivePoints) {
    //       pointsToReceive = networkedData.pointsToGive;
    //     }


    //     if (!networkedData.dontReceivePoints) {
    //       pointsToGive = 2;
    //     }
    //     if (
    //       (participantData.pointsToGive && participantData.pointsToGive > 0)
    //       && !networkedData.dontReceivePoints) {
    //         pointsToGive = participantData.pointsToGive

    //     }
    //   }




    //   console.log('VERIFICANDO networkedProfile');


    //   // pegar número do participante de network
    //   const networkedProfile = await firestore.collection('attendants').doc(event.token).get();
    //   if (!networkedProfile.exists) {
    //     // Error - Perfil de participante que foi informado não encontrado.
    //     return callback(null, {
    //       type: 'networking-scan',
    //       message: '✋ Ocorreu alguma inconsistência na verificação do perfil da pessoa informada.\n\nApresente esta mensagem para alguém da Twilio!'
    //     });
    //   }
    //   const networkedProfileData = networkedProfile.data();
    //   console.log('networkedProfileData', networkedProfileData);
    //   console.log('participanteId', participanteId);

    //   let networkedMessage = `Esta foi a pessoa que acabou de se conectar com você.\n\n${participantData.linkedin}`;

    //   console.log('networkedMessage', networkedMessage);
    //   // check if networked ganhou pontos
    //   if (pointsToGive > 0) {
    //     networkedMessage += `\n\n\nVocê ganhou *${pointsToGive} ponto(s)*.`
    //   }

    //   console.log('enviando notificação ', event.to,
    //     `whatsapp:${networkedProfileData.phoneNumber}`,
    //     networkedMessage );

    //   // enviar mensagem para a pessoa informada
    //   await sendNotification(
    //     client,
    //     event.to,
    //     `whatsapp:${networkedProfileData.phone}`,
    //     networkedMessage
    //   );

    //   console.log('adicionando registro de pontos');

    //   // /score/tdcinnovation2022/attendants/[participanteId]/tokens/network_[networkedId]
    //   await firestore.collection('score')
    //     .doc(currentEvent)
    //     .collection('attendants')
    //     .doc(event.token)
    //     .collection('tokens')
    //     .doc(`networking_${participanteId}`)
    //     .set({
    //       sender: participanteId,
    //       receiver: currentEvent,
    //       pointsToReceive: pointsToReceive,
    //       pointsToGive: pointsToGive,
    //       last_update: admin.firestore.FieldValue.serverTimestamp(),
    //       activations: admin.firestore.FieldValue.increment(1)
    //     }, { merge: true });

    //   await firestore.collection('score')
    //     .doc(currentEvent)
    //     .collection('attendants')
    //     .doc(event.token)
    //     .set({
    //       points: admin.firestore.FieldValue.increment(pointsToGive),
    //       pointsAccumulated: admin.firestore.FieldValue.increment(pointsToGive),
    //       lastUpdate: admin.firestore.FieldValue.serverTimestamp()
    //     }, { merge: true });



    //   // /score/tdcinnovation2022/attendants/[networkedId]/tokens/network_[participanteId]
    //   await firestore.collection('score')
    //     .doc(currentEvent)
    //     .collection('attendants')
    //     .doc(participanteId)
    //     .collection('tokens')
    //     .doc(`networking_${event.token}`)
    //     .set({
    //       sender: participanteId,
    //       receiver: currentEvent,
    //       pointsToReceive: pointsToReceive,
    //       pointsToGive: pointsToGive,
    //       last_update: admin.firestore.FieldValue.serverTimestamp(),
    //       activations: admin.firestore.FieldValue.increment(1)
    //     }, { merge: true });

    //   await firestore.collection('score')
    //     .doc(currentEvent)
    //     .collection('attendants')
    //     .doc(participanteId)
    //     .set({
    //       points: admin.firestore.FieldValue.increment(pointsToReceive),
    //       pointsAccumulated: admin.firestore.FieldValue.increment(pointsToReceive),
    //       lastUpdate: admin.firestore.FieldValue.serverTimestamp()
    //     }, { merge: true });


    //   // TODO: melhorar dinâmica de verificação de pontos e logs
    //   await firestore.collection('networking')
    //     .doc(currentEvent)
    //     .collection('logs')
    //     .add({
    //       sender: participanteId,
    //       receiver: event.token,
    //       pointsToReceive: pointsToReceive,
    //       pointsToGive: pointsToGive,
    //       createdAt: admin.firestore.FieldValue.serverTimestamp()
    //     });




    //   let message = `Aqui está o LinkedIn da pessoa que você encontrou!\n\n${networkedProfileData.linkedin}`;

    //   if (pointsToReceive > 0) {
    //     message += `\n\n\nVocê ganhou *${pointsToReceive} ponto(s)*.`
    //   }
    //   if (pointsToGive > 0) {
    //     message += `\nA pessoa ganhou *${pointsToGive} ponto(s)*.`
    //   }

    //   return callback(null, {
    //     type: 'networking-scan',
    //     message: message
    //   });

    // } else {
    //   console.log('SEM NETWORK');
    //   return callback(null, {
    //     type: 'networking-scan',
    //     message: '✋ Atenção ✋\n\nA pessoa participante que você informou ainda não fez o registro neste evento.'
    //   });

    // }



























    // event.evento, event.token

    // let participanteId = await md5(limpaNumero(event.from));

    // let evento = null;
    // let mensagem = '';
    // let mediaUrl = '';

    // console.log('participanteId', participanteId);

    // const participante = await firestore.collection('participantes')
    //     .doc(participanteId)
    //     .get()
    //     .then( p => p.exists ? p.data() : null );

    // if (participante) {
    //     evento = participante.evento || null;
    //     // Verificar se evento estiver ativo
    //     if (evento != null) {
    //         const participanteEvento = await firestore.collection('events')
    //             .doc(evento)
    //             .get()
    //             .then( e => e.exists ? e.data() : null );
    //         evento = participanteEvento && participanteEvento.active ? evento : null;
    //         mensagem = participante && participanteEvento.message ? participanteEvento.message : '';
    //         mediaUrl = participante && participanteEvento.mediaUrl ? participanteEvento.mediaUrl : '';
    //     }
    // }

    // // Caso não tenha evento definido ou ativo, carregar evento default ativo
    // if (!evento) {
    //     // Sem evento - definir default
    //     const eventos = await firestore.collection('events')
    //         .where('default', '==', true)
    //         .where('active', '==', true)
    //         .get()
    //         .then(snapshot => {
    //             return snapshot.docs.map(doc => {
    //                 return { key: doc.id, ...doc.data() }
    //             });
    //         });

    //     if (eventos.length > 0) {
    //         evento = eventos[0].key
    //         mensagem = eventos[0].message ? eventos[0].message : '';
    //         mediaUrl = eventos[0].mediaUrl ? eventos[0].mediaUrl : '';
    //     }
    // } else {

    // }
    // mensagem = mensagem.split('<e>').join('\n');

    callback(null, {

    });

};
