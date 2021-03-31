"use strict";
/*
  The dict CloudPlatforms contains the constructors of the engines capables of communicating with a given storage.
  Each engine provides rutines to `read`, `write`, `list` and `del`ete files on a given platform.

  Every engine constructor accepts a dict `config` that contains the settings necessary to connect to a given storage (e.g. Dropbox API Token).

  Each engine also exposes a variable `config` that contains information for the UI to present an input field of a given setting property
  (e.g. HTML input tag `type`, a brief description and its `default` value).


  Available engines are: `Local` that only stores data within the device sand-boxed local storage, `SMTP` that sends recording via email (no storage), 
  `Dropbox` that, given a Token key, will upload data there.
*/

const asyncize = (f, ...args) => new Promise(resolve =>   f(...args, resolve), ()=> {throw "asyncized promise failed"});
const asyncize_this = (that, f, ...args) => new Promise(resolve =>   f.bind(that, ...args, resolve)(), ()=> {throw "asyncized promise failed"});

var CloudPlatforms = {

    /* Local storage engine */

    Local: function(config){
	
	let path =  cordova.file.dataDirectory + '/'
	return{
	    description:"Records will be saved locally to the device or browser storage",
	    config: [
		//{key: "path", type:"text", init:"/", description:"This path is relative to the webapp local storage"},
	    ],
	    list: async function(){
		
		let fileSystem = await asyncize(window.resolveLocalFileSystemURL, path)
		let reader = fileSystem.createReader();
		let entries = await asyncize_this(reader, reader.readEntries)
		let result = []
		console.log(entries)
		for (let entry of entries){
		    result.push(entry.fullPath)
		}
		return result
						 
	    },
	    read: async function (fullPath){
		let fileEntry = await asyncize(window.resolveLocalFileSystemURL, path + fullPath)
		let file = await asyncize_this(fileEntry, fileEntry.file);
		let reader = new FileReader();
		let wait_for_reader = function(reader, resFile){
		    return new Promise(function(resolve){
			reader.onloadend = (evt) => resolve(evt.target._result);
			reader.readAsArrayBuffer(resFile)
		    })
		}
		let array_buffer = await wait_for_reader(reader, file);
		let blob = new Blob([array_buffer],  { type: 'video/webm' });
		return blob
	    }, del: async function(fullPath){
		let directoryEntry = await asyncize(window.resolveLocalFileSystemURL, path)
		let fileEntry = await asyncize_this(directoryEntry, directoryEntry.getFile, fullPath ,   { create: true });
		await asyncize_this(fileEntry, fileEntry.remove);

	    }, write: async function (fullPath, data){
		let directoryEntry = await asyncize(window.resolveLocalFileSystemURL, path)
		let fileEntry = await asyncize_this(directoryEntry, directoryEntry.getFile,   fullPath,   { create: true })
		
		fileEntry.createWriter(function(fileWriter) {
		    fileWriter.write(data)
		})
	    }

	}
    },

    /* Send recording that comes as `Blob` in the `write` function, via email */

    SMTP: function(config){
	return {
	    description:"Records will be sent to an email account without being saved. Not available on browsers.",
	    config: [
		{key: "smtp_server", type:"text", init:"smtp.gmail.com"},
		{key:"smtp_username", type:"text"},
		{key:"smtp_password", type:"password", description:"All Camerario data are stored only locally into your device or browser"},
		{key:"subject", type:"text", init:"[Camerario]", description:"Email subject"},
		{key:"email", type:"text"}
	    ],
	    list: async function(){return []    },
	    read: async function (fullPath){return null},
	    write: async function (fullPath, data){
		var mailSettings = {
		    emailFrom: config.email,
		    emailTo: config.email,
		    smtp: config.smtp_server,
		    smtpUserName: config.smtp_username,
		    smtpPassword:  config.smtp_password,
		    subject: config.subject + ' ' ,
		    attachments:[]
		};
		
		smtpClient.sendMail(mailSettings)
	    }

	}
    },

    /* Send recording to a user-created Dropbox app (given its token) */

    Dropbox: function(config){
	return{
	    description:"Records will be sent to a Dropbox app you have to create.",
	    config:[
		{key:"Token", type:"text", description:"All Camerario data are stored only locally into your device or browser"},
	    ],
	    list: async function(){return []    },
	    read: async function (fullPath){return null},
	    write: async function (fullPath, file){
		const UPLOAD_FILE_SIZE_LIMIT = 150 * 1024 * 1024;
		let ACCESS_TOKEN = config.Token.value
		let dbx = new Dropbox.Dropbox({ accessToken: ACCESS_TOKEN });
      		if (file.size < UPLOAD_FILE_SIZE_LIMIT) { // File is smaller than 150 Mb - use filesUpload API
		    let pl = {path: '/'+  fullPath, contents: await file.arrayBuffer()}
		    //pl = {path: '/'+  fullPath, contents: filex}
		    console.log(pl)
		    console.log(pl.contents)
		    await dbx.filesUpload(pl)
		}else{
		    throw "File too big (>150MB)"
		}
		
	    }

	}
    }

}

