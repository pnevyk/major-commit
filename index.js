var majordomo = require('majordomo');
var async = require('async');

module.exports = function (config) {
    async.series({
        modified : function (cb) {
            majordomo.exec('git ls-files --modified --exclude-standard', function (err, output) {
                cb(err, parseFiles(output, 'modified'));
            });
        },
        deleted : function (cb) {
            majordomo.exec('git ls-files --deleted --exclude-standard', function (err, output) {
                cb(err, parseFiles(output, 'deleted'));
            });
        },
        untracked : function (cb) {
            majordomo.exec('git ls-files --others --exclude-standard', function (err, output) {
                cb(err, parseFiles(output, 'untracked'));
            });
        }
    }, function (err, results) {
        results.modified = results.modified.filter(function (item) {
            return results.deleted.indexOf(item) === -1;
        });
        
        var command = majordomo('commit', config);
            
        if (results.modified.length) {
            command.ask('checkbox', 'modified', 'Which of these modified files do you want to add to index?', results.modified);
        }
        
        if (results.untracked.length) {
            command.ask('checkbox', 'untracked', 'Which of these untracked files do you want to add to index?', results.untracked);
        }
        
        if (results.deleted.length) {
            command.ask('checkbox', 'deleted', 'Which of these deleted files do you want to remove from index?', results.deleted);
        }
        
        command.branch(function () {
            return !!(this.get('modified').length || this.get('untracked').length || this.get('deleted').length);
        }, function ()  {
            this.ask('input', 'message', 'Describe this commit').set('change', true);
        });
        
        
        command.run(function () {
            if (this.has('git')) {
                if (this.get('change')) {
                    var data = this.get();
                
                    var toAdd = [], toRemove = [];
                    
                    if (data.modified) toAdd = toAdd.concat(data.modified);
                    if (data.untracked) toAdd = toAdd.concat(data.untracked);
                    if (data.deleted) toRemove = data.deleted;
                    
                    if (toAdd.length) majordomo.exec('git add ' + flattenToLine(toAdd));
                    if (toRemove.length) majordomo.exec('git rm ' + flattenToLine(toRemove));
                    
                    majordomo.exec('git commit -m "' + data.message + '"');
                }
                
                else {
                    majordomo.log('commit', 'No changes to commit');
                }
            }
        });
    });
};

function parseFiles(str, status) {
    return str.split('\n').filter(function (item) {
        return !!item;
    });
}

function flattenToLine(arr) {
    return arr.join(' ');
}