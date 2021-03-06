'use strict';
/**
 * This program attempts to build an inverted index from a JSON file
 * @class InvertedIndex
 * @constructor
 */
class InvertedIndex {
  constructor() {
    /**
     * We need to save multiple inverted indexes
     * @property invertedIndexes
     * @type Object
     * @default {}
     */
    this.invertedIndexes = {};
    this.temp = {}; //placeholder for when building the index
    this.search_result = []; //placeholder for saving search result
    this.temp_search = [];
  }

  /**
   * creates an inverted index from the specified filePath
   * @method createIndex
   * @param {String} filePath
   * @return {Promise}
   */
  createIndex(filePath) {
    return new Promise((fulfill, reject) => {
      this.readJsonFile(filePath).then((jsonObject) => {
        if (!this.isEmpty(jsonObject)) {
          this.populateIndex(filePath, jsonObject); //save the index
          fulfill(this);
        }

        // ask for the index to be built and populated
        reject('Unable to build index, json is empty or not valid');
      }).catch((error) => {

        reject(error);

      });
    });
  }
  /**
   * Returns all index that was created or from the specified JSON file
   * @method getIndex
   * @param filePath (Optional) the specific JSON file indexed
   * @return {Object} the object or objects indexed
   * */
  getIndex(filePath) {
    if (!filePath) {
      return (this.invertedIndexes);
    }

    return this.invertedIndexes[filePath];
  }

  /**
   * Searches the recently indexed object for matches with specified params
   * @method searchIndex
   * @param {Object} varied string search terms, deep nested arrays
   * @return {Object}
   * */
  searchIndex() {
    let searchResult = [];
    let recentIndex = this.getRecentIndex();
    this.resolveParam(arguments); //we resolve complex search terms

    for (let param of this.temp_search) {
      let words = param.split(' ');
      for (let word of words) {
        word = this.filterWord(word);
        if (recentIndex.hasOwnProperty(word)) {
          searchResult.push(Object.keys(recentIndex[word])[0]);
        } else {
          searchResult.push('');
        }
      }
    }

    this.temp_search = [];
    return searchResult;
  }
  /**
   * Searches only the specified indexed file based on the filepath
   * @method searchSpecificIndex
   * @param {Object} terms An array of search terms
   * @param {String} filepath the location of the file
   * @return {Array}
   * */
  searchSpecificIndex(terms, filepath) {
    let searchResult = [];
    let index = this.getIndex(filepath);
    this.resolveParam(arguments); //we resolve complex search terms

    for (let param of this.temp_search) {
      let words = param.split(' ');
      for (let word of words) {
        word = this.filterWord(word);
        if (index.hasOwnProperty(word)) {
          searchResult.push(Object.keys(index[word])[0]);
        }
      }
    }

    this.temp_search = [];
    return searchResult;
  }
  /**
   * Gets the recently created index
   * @method getRecentIndex
   * @return {Object}
   * */
  getRecentIndex() {
    let filePaths = Object.keys(this.getIndex());
    let recentPath = filePaths[filePaths.length - 1];
    return this.getIndex(recentPath);
  }
  /**
   * saves multiple index created using their fileName as key
   * @method populateIndex
   * @param {String} fileName
   * @param {Object} jsonObject
   * @return undefined
   **/
  populateIndex(fileName, jsonObject) {
    this.temp = {}; //makes sure the placeholder is empty before building
    for (let key in jsonObject) {
      if (jsonObject.hasOwnProperty(key)) {

        //we break title and text and build their unique terms
        let titleWords = jsonObject[key].title.split(' ');
        let textWords = jsonObject[key].text.split(' ');

        this.buildUniqueTerms(titleWords, key, 'title');
        this.buildUniqueTerms(textWords, key, 'text');

      }
    }

    this.invertedIndexes[fileName] = this.temp;
  }

  buildUniqueTerms(words, key, property) {
    //let's walk over each word
    words.map((word, index) => {
      word = this.filterWord(word); //filter special character
      if (!this.temp.hasOwnProperty(word)) {
        this.temp[word] = {};
        this.temp[word][key] = [{ key: property, frequency: 1, pos: index, }];
      } else {
        //since the word already exist we try to increase it's frequency
        //and adds the position of each word separated by comma
        if (this.temp[word].hasOwnProperty(key)) { //it point to same indices?
          let termProperties = this.temp[word][key];
          for (let i in termProperties) {
            //we need to be sure if the word appeared twice in the text or title
            if (termProperties[i].key === property) {
              termProperties[i].frequency = ++termProperties[i].frequency;
              termProperties[i].pos += ',' + index;
            } else {
              termProperties.push({
                key: property,
                frequency: 1,
                pos: index,
              });
            }

          }
        } else {
          this.temp[word][key] = [{ key: property, frequency: 1, pos: index, }];
        }

      }

    });

  }

  /**
   * Filters a word by removing special characters from it
   * @method filterWord
   * @param {String} word
   * @return {String} the filtered word
   * */
  filterWord(word) {
    return word.toLowerCase().replace(/[^a-zA-Z 0-9]+/g, '');
  }

  /**
   * Resolving complex search terms and saves it in temp search terms
   * @method resolveParam
   * @return undefined
   * */
  resolveParam() {
    for (let arg of arguments) {
      if (arg instanceof Object && typeof arg !== 'string') {
        for (let item in arg) {
          if (arg.hasOwnProperty(item)) {
            this.resolveParam(arg[item]);
          }
        }
      } else {
        this.temp_search.push(arg);
      }
    }
  }

  /**
   * Asserts if an object is not empty and if it contains the property text
   * and title
   * @method isEmpty
   * @param {Object} arrayObject
   * @return {Boolean} Returns true if empty
   * */
  isEmpty(arrayObject) {
    if (typeof arrayObject === 'object') {
      // it's an object
      if ((Object.keys(arrayObject).length > 0)) {
        //it has some contents
        for (let key in arrayObject) {
          if (arrayObject[key].hasOwnProperty('title') &&
              arrayObject[key].hasOwnProperty('text')) {
            //the content is an array of object with property text and title
            return false;
          }
        }
      }
    }

    return true;
  }

  /**
   * Tries to read file content asynchronously by it's file path and convert it
   * to a json file
   * @method readJsonFile
   * @param {String} filePath location of file to read
   * return {Promise}
   */
  readJsonFile(filePath) {
    return new Promise((fulfill, reject) => {
      //let's find out if the file is a remote file
      let isRemote = this.isRemote(filePath);

      if (isRemote) {
        const http = require('http');
        const url  = require('url');

        filePath = url.parse(filePath);

        let options = {
          host: filePath.host,
          path: filePath.path,
        };

        http.get(options, response => {
          response.setEncoding('utf8');
          response.on('data', data => {

            try {
              let parsedObject = JSON.parse(data);

              if (parsedObject && typeof parsedObject === 'object') {
                fulfill(parsedObject);
              } else {
                reject('JSON file is not valid');
              }
            } catch (e) {
              reject('JSON file is not valid');
            }
          });
          response.on('error', error => reject(error));
        });

      } else {
        //it's probably a local file
        const fs = require('fs');

        fs.readFile(filePath, 'utf-8', (status, data) => {
          if (status !== null) {
            if (status.code === 'ENOENT') {
              reject("Sorry, the file '" + status.path + "' does not exist!");
            } else {
              reject(status);
            }
          } else {
            try {
              let parsedObject = JSON.parse(data);
              if (parsedObject && typeof parsedObject === 'object') {
                fulfill(parsedObject);
              } else {
                reject('JSON file is not valid');
              }
            } catch (e) {
              reject('JSON file is not valid');
            }
          }
        });
      }
    });
  }

  /**
   * Checks if a filepath is a fully qualified remote path
   * @method isRemote
   * @param {String} filepath The file path
   * @return {Boolean} Returns true if it's a remote file
   */
  isRemote(filepath) {
    //does the path have a host?
    const url   = require('url');
    filepath = url.parse(filepath);
    return (filepath.host !== '' && filepath.host !== null);
  }

  removeIndex(filePath) {
    delete this.invertedIndexes[filePath];
  }
}
module.exports = new InvertedIndex();
