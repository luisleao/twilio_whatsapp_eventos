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

/*
    event: evento, token, from
*/
exports.handler = async function(context, event, callback) {


    console.log('EVENT', event);

    let participanteId = await md5(limpaNumero(event.from));

    // // Registrar participante na base geral
    // await firestore.collection('participantes')
    //     .doc(participanteId).set({
    //         phoneNumber: limpaNumero(event.from),
    //         profileName: event.profileName,
    //         ultimoEvento: event.evento,
    //         updatedAt: admin.firestore.FieldValue.serverTimestamp()
    //     }, { merge: true });
    
    let participanteGeral = await firestore.collection('participantes')
        .doc(participanteId).get().then(async s => {
            if (s.exists) {
                return s.data();
            } else {
                return null
            }
    });

    let participante = await firestore.collection('events')
        .doc(event.evento).collection('participantes')
        .doc(participanteId).get().then(async s => {
        if (s.exists) {
            return s.data();
        } else {
            return null;
        }
    });


    let produtoVending = await firestore.collection('vendingmachine')
        .doc(process.env.VENDINGMACHINE_DEFAULT).collection('estoque')
        .doc(event.codigoItem).get().then(s => {
            if (s.exists) {
                return s.data();
            } else {
                return null;
            }
        });

    if (!participanteGeral || !participante) {
        // Erro - produto não encontrado!
        console.log('Participante não encontrado!');
        return callback(null, `Ocorreu um erro no seu registro!\n\nInforme ao time da Twilio!`);
    }

    if (!produtoVending) {
        // Erro - produto não encontrado!
        console.log('Produto não encontrado!');
        return callback(null, `O código informado não foi encontrado!`);
    }

    // Verificar estoque do produto selecionado
    if (produtoVending.estoque <= 0) {
        // Erro - produto sem estoque
        console.log('Produto SEM ESTOQUE!');
        return callback(null, `O produto selecionado está sem estoque!\n\nSeus pontos não serão descontados.`);

    }

    // Verificar pontos do produto selecionado
    // Verificar pontuação de participante
    if (!(participanteGeral.isAdmin || participanteGeral.twilion) && participante.pontosCorrente < produtoVending.pontos) {
        // Participante sem pontuação mínima e participante não Admin/Twilion
        console.log('PARTICIPANTE SEM PONTOS!');
        return callback(null, `Para resgatar este produto, você precisa de ${produtoVending.pontos} pontos.\n\nSua pontuação atual é de ${participante.pontosCorrente} ponto(s).`);
    }


    console.log('RODANDO BATCH');
    // Descontar pontos de participante
    const batch = firestore.batch();

    let participanteRef = firestore.collection('events')
        .doc(event.evento).collection('participantes')
        .doc(participanteId);

    batch.set(participanteRef, {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        pontosCorrente: admin.firestore.FieldValue.increment((participanteGeral.isAdmin || participanteGeral.twilion) ? 0 : produtoVending.pontos * -1),
        resgates: admin.firestore.FieldValue.increment(1)
    }, { merge: true });


    // Adicionar log de resgate em participante
    let resgateRef = firestore.collection('events')
        .doc(event.evento).collection('participantes')
        .doc(participanteId).collection('resgates').doc();

    batch.set(resgateRef, {
        codigo: event.codigoItem,
        pontos: produtoVending.pontos,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });


    // Descontar estoque do produto selecionado
    let vendingRef = firestore.collection('vendingmachine')
        .doc(process.env.VENDINGMACHINE_DEFAULT).collection('estoque')
        .doc(event.codigoItem);

    batch.set(vendingRef, {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        estoque: admin.firestore.FieldValue.increment(-1)
    }, { merge: true });


    // Enviar comando para vending machine
    let comandoRef = firestore.collection('vendingmachine')
        .doc(process.env.VENDINGMACHINE_DEFAULT).collection('comandos')
        .doc()

    batch.set(comandoRef, {
        codigo: event.codigoItem,
        status: 'pending',
        participante: participanteId,
        pontos: produtoVending.pontos,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });



    await batch.commit();
    console.log('BATCH FINALIZADO!');

    return callback(null, `Seu resgate foi realizado com sucesso!\n\nRetire seu item na vending machine.`);

};
