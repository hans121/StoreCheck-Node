var CategorySpecificEnum = {
    LIST_MULTIPLE_CHOICES:  '1', // Answer is one or multiple code values from a list of choices.
    DATE_ENTRY:             '2', // A date entry with assistance from a displayed calendar.
    NUMERIC_VALUE:          '3', // A numeric value, either real or integer.
    FREE_TEXT:              '4', // Free text entry.
    RADIO_CHOICES:          '5', // Answer is only one code value from a list of choices presented as radio buttons.
    LIST_CHOICES:           '6', // Answer is only one code value from a list of choices presented as a pull-down list.
    CALCULATED:             '7'  // Calculated and displayed from values previously entered; requiring no direct data entry.
};

if(typeof(module) != 'undefined') {
    module.exports = {

        CategorySpecificEnum: CategorySpecificEnum,

        getQuestionType: function(category_specific) {
            if(category_specific == CategorySpecificEnum.NUMERIC_VALUE || category_specific == CategorySpecificEnum.FREE_TEXT) {
                return "input";
            } else if(category_specific == CategorySpecificEnum.LIST_MULTIPLE_CHOICES) {
                return "checkbox";
            } else if(category_specific == CategorySpecificEnum.RADIO_CHOICES ||
                category_specific == CategorySpecificEnum.LIST_CHOICES) {
                return "select";
            } else if(category_specific == CategorySpecificEnum.DATE_ENTRY) {
                return "calendar";
            } else {
                return "";
            }
        }
    };
}


