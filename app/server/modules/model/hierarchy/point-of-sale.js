var db = require('./../../database/semi-dynamic-database');
var pos = db.db.collection('point-of-sale');
var dbUtils = require('../../database/database-utils');

var index_keys = [
    //{ _id: 1, timestamp: 1, source: 1 },
    { _id: 1, timestamp: 1, source: 1, organization: 1 }
];

dbUtils.addStandardMethods(exports, pos, index_keys);

/*
Excipio Category Code,Label,CBU,Auditors
Address_id,Address_id
Address_type_code,Address Type
Account_number,Account Reference
Company_name,Company Name,X,X
Address1,Address1,X,X
Address2,Address2,X,X
Address3,Address3r
City,City,X,X
State,State,X,X
Postal_code,Zip/Postal Code,X,X
Country,Country
Latitute,Latitude
Longitude,Longitude
A12_code,ISO Country
County,County
A47_code,Store Check Candidate
A48_code,Region of Sales
A50_code,Distribution Channel Type,X
A52_code,Danone Platform
A53_code,Administrative Area,X
A54_code,Preparation Type
A56_code,Mechanization
A57_code,Customer Platform
A59_code,Customer
*/