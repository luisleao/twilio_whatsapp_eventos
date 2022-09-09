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
    event: codigoItem, quantidadeItem
*/
exports.handler = async function(context, event, callback) {

    // TODO: Atualizar estoque de produto da vending machine
    let data = {};
    let mensagem = [];

    await firestore.collection('vendingmachine')
        .doc(process.env.VENDINGMACHINE_DEFAULT).collection('estoque')
        .doc(event.codigoItem).set({
            estoque: parseInt(event.quantidadeItem),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true}).then(() => {
            mensagem.push('Estoque atualizado com sucesso!');
        }).catch(e => {
            mensagem.push('Ocorreu um erro ao mudar o estoque.');
        });

    data.mensagem = mensagem.join('\n\n');

    callback(null, data);

};
