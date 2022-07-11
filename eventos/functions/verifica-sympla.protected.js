let { Sympla } = require('sympla');
const sympla = new Sympla(process.env.SYMPLA_KEY);

const admin = require('firebase-admin');
process.env.GOOGLE_APPLICATION_CREDENTIALS = Runtime.getAssets()['/firebase-credentials.json'].path;

if (!admin.apps.length) {
  admin.initializeApp({}); 
} else {
  admin.app();
}
const firestore = admin.firestore();



exports.handler = async function(context, event, callback) {
  console.log('ticket_number', event.ticket_number)
  let participante = await sympla.listarParticipantesEvento(process.env.EVENTO_ATUAL,{
    ticket_number: event.ticket_number
  }).then(lista => {
    console.log('RETORNOU ', lista);
    if (lista.data && lista.data.length == 1) {
      return lista.data[0];
    }
    return null;
  });

  if (participante != null) {
    // verificar se ja usou o codigo
    const sympla = await firestore.collection('events').doc('frontin').collection('sympla').doc(event.ticket_number.toUpperCase()).get();
    if (sympla.exists) {
        // Erro - participante já utilizou este codigo
        return callback(null, {
          resultado: 'USADO',
          mensagem: 'Este código do Sympla já foi utilizado.'
        });
    }
    
  }

  callback(null, {
    resultado: participante != null ? 'VALIDO' : 'INEXISTENTE',
    existe: participante != null,
    ...participante
  });
};
