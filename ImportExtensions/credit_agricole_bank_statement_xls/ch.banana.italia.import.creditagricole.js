// Copyright [2026] [Banana.ch SA - Lugano Switzerland]
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
//     http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// @id = ch.banana.italia.import.creditagricole
// @api = 1.0
// @pubdate = 2026-05-13
// @publisher = Banana.ch SA
// @description = Credit Agricole - Import account statement .csv (Banana+ Advanced)
// @description.en = Credit Agricole - Import account statement .csv (Banana+ Advanced)
// @description.de = Credit Agricole - Bewegungen importieren .csv (Banana+ Advanced)
// @description.fr = Credit Agricole - Importer mouvements .csv (Banana+ Advanced)
// @description.it = Credit Agricole - Importa movimenti .csv (Banana+ Advanced)
// @doctype = *
// @docproperties =
// @task = import.transactions
// @outputformat = transactions.simple
// @inputdatasource = openfiledialog
// @inputencoding = utf8
// @inputfilefilter = Text files (*.txt *.csv);;All files (*.*)
// @inputfilefilter.de = Text (*.txt *.csv);;Alle Dateien (*.*)
// @inputfilefilter.fr = Texte (*.txt *.csv);;Tous (*.*)
// @inputfilefilter.it = Testo (*.txt *.csv);;Tutti i files (*.*)
// @includejs = import.utilities.js

/**
 * Parse the data and return the data to be imported as a tab separated file.
 */
function exec(inData, isTest) {

	var importUtilities = new ImportUtilities(Banana.document);

	if (isTest !== true && !importUtilities.verifyBananaAdvancedVersion())
		return "";

	convertionParam = defineConversionParam(inData);

	var transactions = Banana.Converter.csvToArray(inData, convertionParam.separator, convertionParam.textDelim);

	// Format 1
	var CAFormat1 = new CreditAgricoleFormat1();
	var transactionsData = CAFormat1.getFormattedData(transactions, importUtilities);
	if (CAFormat1.match(transactionsData)) {
		transactions = CAFormat1.convert(transactionsData);
		return Banana.Converter.arrayToTsv(transactions);
	}

	// Format 2
	var CAFormat2 = new CreditAgricoleFormat2();
	transactionsData = CAFormat2.getFormattedData(transactions, importUtilities);
	if (CAFormat2.match(transactionsData)) {
		transactions = CAFormat2.convert(transactionsData);
		return Banana.Converter.arrayToTsv(transactions);
	}

	importUtilities.getUnknownFormatError();

	return "";
}

/**
 * Credit Agricole Format 2
 * Example: ca.#20260415
 * Data Op.;Data Val.;Causale;Descrizione;Importo;Divisa
 * 04/05/2026;01/05/2026;PRELIEVO;PREL. CON CARTA;'-200,00;EUR
 * 04/05/2026;04/05/2026;PAGAMENTO;ADDEBITO;'-10,00;EUR
 * 30/04/2026;30/04/2026;GIROCONTO/BONIFICO;PAGAMENTO;530,91;EUR
 * 30/04/2026;30/04/2026;INTERESSI/COMPETENZE;CANONE MENSILE;'-11,14;EUR
 **/
function CreditAgricoleFormat2() {

   /** Return true if the transactions match this format */
   this.match = function (transactionsData) {

		if (transactionsData.length === 0)
			return false;

		for (var i = 0; i < transactionsData.length; i++) {
			var transaction = transactionsData[i];

			var formatMatched = false;

			if (transaction["Date"] && transaction["Date"].length >= 10 &&
				transaction["Date"].match(/^[0-9]+[\/\.]+[0-9]+[\/\.][0-9]+$/))
				formatMatched = true;
			else
				formatMatched = false;

			if (transaction["DateValue"] && transaction["DateValue"].length >= 10 &&
				transaction["DateValue"].match(/^[0-9]+[\/\.]+[0-9]+[\/\.][0-9]+$/))
				formatMatched = true;
			else
				formatMatched = false;

			if (formatMatched)
				return true;
		}
		return false;
	}

   this.convertHeaderIt = function (columns) {
      let convertedColumns = [];
   
      for (var i = 0; i < columns.length; i++) {
         switch (columns[i]) {
            case "Data Op.":
               convertedColumns[i] = "Date";
               break;
            case "Data Val.":
               convertedColumns[i] = "DateValue";
               break;
            case "Causale":
               convertedColumns[i] = "Reason";
               break;
            case "Descrizione":
               convertedColumns[i] = "Description";
               break;
            case "Importo":
               convertedColumns[i] = "Amount";
               break;
            case "Divisa":
               convertedColumns[i] = "Currency";
               break;
            default:
               break;
         }
      }
   
      if (convertedColumns.indexOf("Date") < 0) {
         return [];
      }
   
      return convertedColumns;
   }

   this.getFormattedData = function (inData, importUtilities) {
      var columns = importUtilities.getHeaderData(inData, 0); //array
      var rows = importUtilities.getRowData(inData, 1); //array of array
      let form = [];
   
      let convertedColumns = [];
   
      convertedColumns = this.convertHeaderIt(columns);
   
      //Load the form with data taken from the array. Create objects
      if (convertedColumns.length > 0) {
         importUtilities.loadForm(form, convertedColumns, rows);
         return form;
      }
   
      return [];
   }

   this.convert = function (transactionsData) {
      var transactionsToImport = [];

      for (var i = 0; i < transactionsData.length; i++) {
         
         if (transactionsData[i]["Date"] && transactionsData[i]["Date"].length >= 10 &&
            (transactionsData[i]["Date"].match(/^\d{2}\/\d{2}\/\d{4}$/) || 
            transactionsData[i]["Date"].match(/^\d{2}\.\d{2}\.\d{4}$/))) {
            transactionsToImport.push(this.mapTransaction(transactionsData[i]));
         }
      }

      // Sort rows by date
      transactionsToImport = transactionsToImport.reverse();

      // Add header and return
      var header = [["Date", "DateValue", "Doc", "ExternalReference", "Description", "Income", "Expenses"]];
      
      return header.concat(transactionsToImport);
   }

   this.mapTransaction = function (transaction) {
      let mappedLine = [];

      mappedLine.push(Banana.Converter.toInternalDateFormat(transaction["Date"], "dd.mm.yyyy"));
      mappedLine.push(Banana.Converter.toInternalDateFormat(transaction["DateValue"], "dd.mm.yyyy"));
      mappedLine.push("");
      mappedLine.push("");
      mappedLine.push(this.getDescription(transaction));
      if (transaction["Amount"].substring(0, 1) === "-") {
         mappedLine.push("");
         mappedLine.push(Banana.Converter.toInternalNumberFormat(transaction["Amount"].substring(1), ','));
      } else {
         mappedLine.push(Banana.Converter.toInternalNumberFormat(transaction["Amount"], ','));
         mappedLine.push("");
      }     
       

       return mappedLine;
   }

   this.getDescription = function (transaction) {
      if (!transaction) return "";
      const { "Description": description, "Reason": reason} = transaction;
      return [description, reason]
         .filter(value => value && typeof value === "string" && value.trim() !== "")
         .join(", ");
   }
}

/**
 * Credit Agricole format 1
 * Data contabile	Data valuta	Importo	Descrizione	Note
 * 31.05.2023	31.05.2023	3.736,05	Descrizione Movimento	
 * 29.05.2023	29.05.2023	68,94	Descrizione  Movimento	
 * 15.05.2023	15.05.2023	-1,29	Descrizione movimento	
 * 
 * Dates could be in format: dd.mm.yyyy or dd-mm-yyyy or dd/mm/yyyy
 * 
 */
function CreditAgricoleFormat1() {
	/** Return true if the transactions match this format */
    this.match = function (transactionsData) {
		if (transactionsData.length === 0)
		   	return false;
  
		for (var i = 0; i < transactionsData.length; i++) {
			var transaction = transactionsData[i];
			var formatMatched = true;
		   
			if (formatMatched && transaction["Date"] && transaction["Date"].length >= 10 &&
				(transaction["Date"].match(/^\d{2}\/\d{2}\/\d{4}$/) || 
				transaction["Date"].match(/^\d{2}\.\d{2}\.\d{4}$/)))
				formatMatched = true;
			else
				formatMatched = false;
	
			if (formatMatched)
				return true;
		}
  
		return false;
	 }
 
	 this.getFormattedData = function (inData, importUtilities) {
		let headerLineStart = 11;
		let dataLineStart = 12;
		let transactionsCopy = JSON.parse(JSON.stringify(inData));
		if (transactionsCopy.length < dataLineStart)
			return [];
		var columns = importUtilities.getHeaderData(inData, headerLineStart); //array
		var rows = importUtilities.getRowData(inData, dataLineStart); //array of array
		let form = [];
		
		let convertedColumns = [];
		
		convertedColumns = this.convertHeaderIt(columns);
	
		//Load the form with data taken from the array. Create objects
		if (convertedColumns.length > 0) {
			importUtilities.loadForm(form, convertedColumns, rows);
			return form;
		}
		
		return [];
	}
 
	this.convertHeaderIt = function (columns) {
		let convertedColumns = [];
		
		for (var i = 0; i < columns.length; i++) {
			switch (columns[i]) {
				case "Data Op.":
					convertedColumns[i] = "Date";
					break;
				case "Data Val.":
					convertedColumns[i] = "DateValue";
					break;
				case "Importo":
					convertedColumns[i] = "Amount";
					break;
				case "Descrizione":
					convertedColumns[i] = "Description";
					break;
				default:
					break;
			}
		}
		
		if (convertedColumns.indexOf("Date") < 0) {
			return [];
		}
		
		return convertedColumns;
	}
  
	this.convert = function (transactionsData) {
		var transactionsToImport = [];
  
		for (var i = 0; i < transactionsData.length; i++) {
		   
		   if (transactionsData[i]["Date"] && transactionsData[i]["Date"].length >= 10 &&
			 (transactionsData[i]["Date"].match(/^\d{2}\/\d{2}\/\d{4}$/) || 
			 transactionsData[i]["Date"].match(/^\d{2}\.\d{2}\.\d{4}$/))) {
			  transactionsToImport.push(this.mapTransaction(transactionsData[i]));
		   }
		}
  
		// Sort rows by date
		transactionsToImport = transactionsToImport.reverse();
  
		// Add header and return
		var header = [["Date", "DateValue", "Doc", "ExternalReference", "Description", "Income", "Expenses"]];
		
		return header.concat(transactionsToImport);
	}
  
	this.mapTransaction = function (transaction) {
		let mappedLine = [];
	
		mappedLine.push(Banana.Converter.toInternalDateFormat(transaction["Date"], "dd.mm.yyyy"));
		mappedLine.push(Banana.Converter.toInternalDateFormat("", "dd.mm.yyyy"));
		mappedLine.push("");
		mappedLine.push("");
		mappedLine.push(transaction["Description"]);
		if (transaction["Amount"].match(/^[0-9]/))
			mappedLine.push(Banana.Converter.toInternalNumberFormat(transaction["Amount"], '.'));
		else {
			mappedLine.push(Banana.Converter.toInternalNumberFormat(transaction["Amount"], '.'));       
		}

		return mappedLine;
	}
}

function defineConversionParam(inData) {
	var convertionParam = {};
	/** SPECIFY THE SEPARATOR AND THE TEXT DELIMITER USED IN THE CSV FILE */
	convertionParam.format = "csv"; // available formats are "csv", "html"
	//get text delimiter
	convertionParam.textDelim = "§";
	// get separator
	convertionParam.separator = findSeparator(inData);

	/** SPECIFY THE COLUMN TO USE FOR SORTING
	If sortColums is empty the data are not sorted */
	convertionParam.sortColums = ["Date", "Description"];
	convertionParam.sortDescending = false;

	return convertionParam;
}

function findSeparator(inData) {

	var commaCount = 0;
	var semicolonCount = 0;
	var tabCount = 0;

	for (var i = 0; i < 1000 && i < inData.length; i++) {
		var c = inData[i];
		if (c === ',')
			commaCount++;
		else if (c === ';')
			semicolonCount++;
		else if (c === '\t')
			tabCount++;
	}

	if (tabCount > commaCount && tabCount > semicolonCount) {
		return '\t';
	}
	else if (semicolonCount > commaCount) {
		return ';';
	}

	return ',';
}
