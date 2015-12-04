
module.exports = {

    getCellLettersByIndex: _getCellLettersByIndex,

    getFormatCodeFromWeight: _getFormatCodeFromWeight

};

//

var _cellLetterArray = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"];

function _getCellLettersByIndex(index) {
    return _cellLetterArray[index];
}

function _getFormatCodeFromWeight(weight) {
    if(weight == 'A' || weight.toLowerCase() == 'conform') {
        return '[GREEN]';
    } else if(weight == 'B' || weight.toLowerCase() == 'alert') {
        return '[YELLOW]';
    } else if(weight == 'C' || weight.toLowerCase() == 'non-conform') {
        return '[RED]';
    }
    return 'General';
}
