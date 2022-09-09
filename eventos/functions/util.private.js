
exports.escondeNumero = function(number) {
    // +5511999991234 => +55119****-1234
    if (number) number = number.replace('whatsapp:', '');
    if (!number || number.length < 12) return '+-----****-----';
    return number.substr(0, number.length - 8) + '****-' + number.substr(number.length - 4 )
}

exports.limpaNumero = function(number, removeMais) {
    if (number) number = number.replace('whatsapp:', '');
    if (number && removeMais) number = number.replace('+', '');
    return number;
}

exports.getDDD = function(number) {
    if (number) number = number.replace('whatsapp:+', '');
    number = number.substr(0,4);
    return number;
}

exports.validateEmail = function(email) {
    const re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
}

exports.convertNewLine = (text) => {
    return text.split('<e>').join('\n');
}

exports.fillParams = (text, params) => {
    return Object.keys(params).reduce((prev, key)=> {
        return prev.split(`{{${key}}}`).join(params[key]);
    }, `${text}`);
}

exports.sendNotification = async (client, from, to, message) => {
    return await client.messages.create({
        from: from,
        to: to,
        body: message
    });
}
  
exports.sendNotificationMedia = async (client, from, to, message, mediaUrl) => {
    return await client.messages.create({
        from: from,
        to: to,
        body: message,
        mediaUrl
    });
}

exports.adicionaNove = (number) => {
    if (number.split('+55').length > 1) {
        if (number.length == 13) {
            return number.substr(0, number.length - 8) + '9' + number.substr(number.length - 8);
        }
        return number;
    }
    return number;
}