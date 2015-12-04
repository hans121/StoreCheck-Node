// Module: FileLineReader
// Constructor: FileLineReader(filename, bufferSize = 8192)
// Methods: hasNextLine() -> boolean
//          nextLine() -> String
//
//
var fs = require("fs");

exports.FileLineReader = function(filename, encoding, bufferSize) {

    if(!bufferSize) {
        bufferSize = 1048576; // 1 MB buffer
    }

    //private:
    var currentPositionInFile = 0;
    var buffer = "";
    var fd = fs.openSync(filename, "r");

    var stats = fs.fstatSync(fd);
    var fileSizeInBytes = stats.size;


    // return -1
    // when EOF reached
    // fills buffer with next (bufferSize) or less bytes
    var fillBuffer = function(position) {

        var res = fs.readSync(fd, bufferSize, position, encoding);

        buffer += res[0];
        if (res[1] == 0) {
            return -1;
        }
        return position + res[1];

    };

    currentPositionInFile = fillBuffer(0);

    //public:
    this.hasNextLine = function() {
        while (buffer.indexOf("\n") == -1) {
            currentPositionInFile = fillBuffer(currentPositionInFile);
            if (currentPositionInFile == -1) {
                return false;
            }
        }

        if(buffer.indexOf("\n") > -1) {

            return true;
        }
        return false;
    };

    //public:
    this.nextLine = function() {
        var lineEnd = buffer.indexOf("\n");
        var result = buffer.substring(0, lineEnd);

        buffer = buffer.substring(result.length + 1, buffer.length);
        return result;
    };

    this.getCurrentPosition = function() {
        return currentPositionInFile;
    };

    this.getFileSize = function() {
        return fileSizeInBytes;
    };

    return this;
};


