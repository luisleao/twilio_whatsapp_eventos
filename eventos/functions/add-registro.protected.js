const admin = require('firebase-admin');
process.env.GOOGLE_APPLICATION_CREDENTIALS = Runtime.getAssets()['/firebase-credentials.json'].path;
const { escondeNumero, limpaNumero, getDDD, convertNewLine } = require(Runtime.getFunctions()['util'].path);


if (!admin.apps.length) {
    admin.initializeApp({}); 
} else {
    admin.app();
}

const firestore = admin.firestore();
const md5 = require('md5');

exports.handler = async function(context, event, callback) {
    const client = await context.getTwilioClient();

    console.log('ADD REGISTRO: ', event);

    let participanteId = await md5(limpaNumero(event.from));

    let participante = {
        phoneNumber: limpaNumero(event.from),
        impressoes: 0
    }


    switch(event.modo) {
        case 'sympla':
            // Verificar se existe no Sympla
            const sympla = await firestore.collection('events').doc(event.evento).collection('sympla').doc(event.sympla.toUpperCase()).get();
            if (sympla.exists) {
                // Erro - participante já utilizou este codigo
                return callback(null, {
                    erro: true,
                    mensagem: 'Este código do Sympla já foi utilizado.'
                });
            }
            break;

        case 'email':
            // Verificar se existe no Email
            const registroEmail = await firestore.collection('events').doc(event.evento).collection('emails').doc(event.email.toLowerCase()).get();
            if (!registroEmail.exists) {
                // Erro - Email não encontrado
                return callback(null, {
                    erro: true,
                    mensagem: `O e-mail *${event.email.toLowerCase()}* não foi encontrado no sistema.`
                });
            }

            const emailData = registroEmail.data();
            if (emailData.usado) {
                // Erro - participante já utilizou este emai;
                return callback(null, {
                    erro: true,
                    mensagem: `O e-mail *${event.email.toLowerCase()}* já foi utilizado em um registro.`
                });
            }
            Object.assign(participante, {...emailData});
            break;

        case 'manual':
            console.log('REGISTRO MANUAL');
            break;
    }



    // Adicionando parâmetros no participante, independente do modelo
    const allowedElements = ['nome', 'pronome', 'sympla', 'linkedin', 'email', 'firstName', 'lastName', 'empresa'];
    Object.keys(allowedElements).map((e, idx) => {
        console.log('registro > ', allowedElements[e], event[allowedElements[e]]);
        if (event[allowedElements[e]]) {
            participante[allowedElements[e]] = event[allowedElements[e]]
        }
    });

    console.log('DADOS PARA INSERIR: ', participante);



    // Salvar o registro do participante
    await firestore.collection('events').doc(event.evento).collection('participantes')
        .doc(participanteId).set({
            ...participante,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

    await firestore.collection('participantes')
        .doc(participanteId).set({
            ...participante,
            ultimoEvento: event.evento,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

    // Salvar o registro de uso do E-mail/Sympla

    switch(event.modo) {
        case 'sympla':
            await firestore.collection('events').doc(event.evento).collection('sympla')
                .doc(event.sympla.toUpperCase()).set({
                participanteId: participanteId,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            break;
        case 'email':
            await firestore.collection('events').doc(event.evento).collection('emails')
            .doc(event.email.toLowerCase()).set({
                usado: true
            }, { merge: true });
            break;
    }
 
    return callback(null, {
        erro: true,
        mensagem: convertNewLine(event.mensagemSucesso)
    });

};