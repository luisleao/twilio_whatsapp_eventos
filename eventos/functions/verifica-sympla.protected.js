let { Sympla } = require('sympla');
const sympla = new Sympla(process.env.SYMPLA_KEY);

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

  callback(null, {
    existe: participante != null,
    ...participante
  });
};
