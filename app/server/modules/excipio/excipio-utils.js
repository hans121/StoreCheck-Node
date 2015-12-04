
exports.getLocalFolderFromFilename = _getLocalFolderFromFilename;

exports.FILE_PREFICES = {
    ADDRESS: "Addr_",
    PRODUCTS: "Prod_",
    AUDIT_GRIDS: "T02_",
    AUDIT_GRID_TRANSLATIONS: "T02Tr_",
    ADMIN_AREAS: "A53_",
    CUSTOMER_PLATFORMS: "A57_",
    CUSTOMERS: "A59_",
    DANONE_PLATFORMS: "A52_",
    FACTORIES: "C73_",
    PRODUCTION_LINES: "C91_",
    REGIONS_OF_SALES: "A48_"
};

function _getLocalFolderFromFilename(filename) {
    if(filename.indexOf('T02_') != -1) {
        return 'data/templates/hierarchy/';
    } else if(filename.indexOf('Addr_') != -1) {
        return 'data/pos/';
    } else if(filename.indexOf('Prod_') != -1) {
        return 'data/products/';
    } else if(filename.indexOf('A48_') != -1) {
        return 'data/region_of_sales/';
    } else if(filename.indexOf('A52_') != -1) {
        return 'data/danone_platforms/';
    } else if(filename.indexOf('A53_') != -1) {
        return 'data/administrative_areas/';
    } else if(filename.indexOf('A57_') != -1) {
        return 'data/customer_platforms/';
    } else if(filename.indexOf('A59_') != -1) {
        return 'data/customers/';
    } else if(filename.indexOf('C73_') != -1) {
        return 'data/factories/';
    } else if(filename.indexOf('C91_') != -1) {
        return 'data/production_lines/';
    } else if(filename.indexOf('T02_') != -1) {
        return 'data/templates/hierarchy/';
    } else if(filename.indexOf('T02Tr_') != -1) {
        return 'data/templates/language/';
    }
    return 'data/_archive/';
    //A12_MMddyyyy_hhmmss
    //A50_MMddyyyy_hhmmss
    //A54
    //A56
    //AO05
}
