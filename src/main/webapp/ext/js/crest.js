var log = new Logger( true );
function Logger(isDebug) {
	if(isDebug==true)
		this.isDebug = true;
	else
		this.isDebug = false;

	this.debug = function(msg,obj) {
		console.debug(this.prefix() + " DEBUG - " + msg);
		if(obj)console.debug(obj);
	}
	this.warn = function(msg,obj) {
		console.warn(this.prefix() + " WARN  - " + msg);
		if(obj)console.warn(obj);
	}
	this.error = function(msg,obj) {
		console.error(this.prefix() + " ERROR - " + msg);
		if(obj)console.error(obj);
	}
	this.log = function(msg,obj) {
		console.log(this.prefix() + " LOG   - " + msg);
		if(obj)console.log(obj);
	}
	//ensure prefix is a fixed length for easy reading
	this.prefix = function() {
		var d = new Date();
		return this.toTwoDigits(d.getHours())+":"+this.toTwoDigits(d.getMinutes())+":"+this.toTwoDigits(d.getSeconds())+","+this.toFourDigits(d.getMilliseconds());
	}
	this.toTwoDigits = function(num) {
		if(num<10) return "0"+num;
		return num;
	}
	this.toFourDigits = function(num) {
		if(num<10) return "000"+num;
		if(num<100) return "00"+num;
		if(num<1000) return "0"+num;
		return num;
	}
}
//i know i know, it's not perfect
function Timer() {
	this.start = new Date().getTime();
	this.elapsed = -1;
	
	this.elapsed = function() {
		this.elapsed = new Date().getTime()-this.start;
		return this.elapsed;
	}
}
function Request(name,ajaxCtx) {
	this.name = name;
	this.ajaxctx = ajaxCtx;
	this.dateTouched = null;
	this.ajaxctx.xhr = null;
	this.ajaxctx.timer = null;
}
/**
 * Encapsulate access to persistence here so we can easily get off of 
 * localStorage if need be; perhaps Web SQL database?
 * 
 * TODO: Let's get the uri and header history behind this object too. 
 */
function Persistence() {
	this.reqStoreKey = "reqSuitcase";
	this.uriHistoryKey = "uriHistory";
	this.headerHistoryKey = "headerHistory";
	
	this.listURIs = function() {
		return storageObj(this.uriHistoryKey);
	}
	
	this.storeURI = function(uri) { this.storeURIs([uri]);}
	
	this.storeURIs = function(uris,replaceAll) {
		if(replaceAll)
			var uriHist = new Array();
		else
			var uriHist = storageObj(this.uriHistoryKey);	
		
		var storeIt = false;
		for( var i = 0; i < uris.length; i++ ) {
			if( $.inArray(uris[i],uriHist) == -1 ) {
				storeIt = true;
				uriHist.push(uris[i]);
			}
		}
		if(storeIt) {
			if(log.isDebug) log.debug( "storeURIs storing uris:",uriHist );
			storageObj(this.uriHistoryKey,uriHist.sort());
		} else if(log.isDebug) {
			log.debug( "storeURIs not storing uris, all must already exist:",uriHist );
		}
	}
	
	this.listHeaders = function() {
		return storageObj(this.headerHistoryKey);
	}
	
	/**
	 * Replace all or append header history.
	 */
	this.storeHeaders = function(reqHeaders,replaceAll) {
		if(log.isDebug) log.debug( "storeHeaders called with headers:",reqHeaders );
		
		if(replaceAll)
			var headerHist = new Array();
		else
			var headerHist = storageObj(this.headerHistoryKey);
		
		var storeIt = false;
		for( var i = 0; i < reqHeaders.length; i++ ) {//for each header
			//coming from a textarea
			if(typeof reqHeaders[i] == "string")
				var header = reqHeaders[i];
			else//coming from an ajax request so it's header object.
				var header = reqHeaders[i].name + ": " + reqHeaders[i].value;//create the header string
			
			//don't think i need this - headerHist.length == 0 || 
			if( $.inArray(header,headerHist) == -1 ) {//and see if we should push it
				storeIt = true;
				headerHist.push( header );
			}
		}
		if(storeIt) {
			if(log.isDebug) log.debug( "storeHeaders storing headers:",headerHist );
			storageObj(this.headerHistoryKey,headerHist.sort());
		} else if(log.isDebug) {
			log.debug( "storeHeaders not storing headers, all must already exist:",reqHeaders );
		}
	}
	
	/**
	 * All the request related methods. 
	 */
	
	this.listRequests = function() {
		return storageObj(this.reqStoreKey).items;
	}

	this.listRequestNames = function() {
		return storageObj(this.reqStoreKey+"Items");
	}
	
	this.listRequestNamesSortedByDate = function() {
		return storageObj(this.reqStoreKey+"Items");
	}
	
	this.getHomeRequest = function() {
		var store = storageObj(this.reqStoreKey);
		//store.homeRequest = null;
		if(store.homeRequest) {
			if(log.isDebug)log.debug( "returning existing home Request..." );
			return store.homeRequest;
		}
			

		var ajaxCtx = new AjaxContext("GET","","","");
		var homeReq = new Request("cREST Default",ajaxCtx);
		homeReq.isDefault = true;
		store.homeRequest = homeReq;
		
		storageObj(this.reqStoreKey,store);
		if(log.isDebug)log.debug( "returning new cREST Default home request..." );
		return store.homeRequest;
	}
	this.changeHomeRequest = function(name) {
		var req = this.locateRequest(name, false);
		var store = storageObj(this.reqStoreKey);
		store.homeRequest = req;
		storageObj(this.reqStoreKey,store);
	}
	
	this.locateRequest = function(name,touch) {
		if(log.isDebug)log.debug( "locateRequest('" + name + "')" );
		var store = storageObj(this.reqStoreKey);
		for(var i = 0; i < store.items.length; i++ )
			if( store.items[i].name == name) {
				break;//now i points to the item.
			}
		
		var returnItem = store.items[i];
		if(! returnItem ) {
			if(log.isDebug)log.debug( "locateRequest('" + name + "') but we can't find it!" );
			return;
		}

		if(touch) {
			if(log.isDebug) log.debug( "touching item with name '" + name + "'" );
			returnItem.dateTouched = new Date();
			this.storeRequestsAndNames(store);	
		} else if( log.isDebug ) {
			log.debug( "NOT touching item with name '" + name + "'" );
		}
		if(log.isDebug)log.debug( "locateRequest('" + name + "') Returning request item:",returnItem );
		return returnItem;
	}

	this.storeRequest = function(request,store) {
		request.name = $.trim(request.name);
		var givenStore = true;
		if(!store) {
			var store = storageObj(this.reqStoreKey);
			givenStore = false
		} 
			
		
		request.dateTouched = new Date();
		store.items.push(request);
		if(log.isDebug)log.debug( "storeRequest called "+((givenStore)?" WITH":" WITHOUT")+" a store and request:", request );
		return this.storeRequestsAndNames(store);
	}
	
	this.replaceRequest = function(request,replaceName) {
		
		if(!replaceName)
			var replaceName = request.name;

		if(log.isDebug) {log.debug( "replaceRequest called. replacing name '" +replaceName+ "' with new request object:",request );}

		
		var store = storageObj(this.reqStoreKey);
		var newStore = {"items":[]};
		for(var i = 0; i < store.items.length; i++ )//create new store w/out the request
			if( store.items[i].name != replaceName)
				newStore.items.push(store.items[i]);
	
		if( store.items.length == newStore.items.length ) 
			log.warn("You called replace for name '" + replaceName + "' but it doesn't exist in the store. This could happen if someone chooses to update an existing request, then changes the name of it.");
		
		this.storeRequest(request,newStore);
	}
	
	
	this.removeRequest = function(name) {
		if(log.isDebug) {log.debug( "removeRequest called with name '" + name + "'" );}
		var store = storageObj(this.reqStoreKey);
		var newStore = {"items":[]};
		for(var i = 0; i < store.items.length; i++ )
			if( store.items[i].name != name)
				newStore.items.push(store.items[i]);
		
		if( store.items.length == newStore.items.length ) {
			log.error("can't remove item named '" + name + "' for some reason.");
			return false;
		} else if( log.isDebug )
			log.debug("removed item named '" + name + "'");
		
		return this.storeRequestsAndNames(newStore); 
		
	}
	
	this.storeRequestsAndNames = function(store) {
		//by default we'll always put the newest ones first, i should move this code out of here 
		//so that we can sort by name, uri, etc...
		store.items.sort(this.sortRequestsByName);
		
		var storeNames = new Array();
		for(var i = 0; i < store.items.length; i++ ) {	
			storeNames.push( store.items[i].name );
		}
		if(log.isDebug)log.debug( "storeRequestsAndNames called with store:", store );
		var success = storageObj(this.reqStoreKey+"Items",storeNames) && storageObj(this.reqStoreKey,store);
		return success;
	}
	this.sortRequestsByName = function (a, b) {
		aname = a.name.toLowerCase();
		bname = b.name.toLowerCase();
		if( aname>bname )
			return 1;
		if( aname<bname )
			return -1
		return 0;
	}
	this.sortRequestsByDateTouched = function (a, b) {
		var aDate = new Date(a.dateTouched);
		var bDate = new Date(b.dateTouched);
		if( bDate>aDate )
			return 1;
		if( bDate<aDate )
			return -1
		return 0;
	}
	
	//TODO - test all the init stuff
	this.init = function() {
		if(! $.isArray(storageObj(this.uriHistoryKey)) ) {
			storage(this.uriHistoryKey,"[]");
		}
		
		if(! $.isArray(storageObj(this.headerHistoryKey)) ) {
			storage(this.headerHistoryKey,"[]");
		}
		var store = storageObj(this.reqStoreKey); 
		if(!store) {
			store = {"items":[]};
		}
		this.storeRequestsAndNames(store);
		return this;
	}

}

function AjaxContext(method,uri,reqEntity,reqHeaders) {
	this.xhr = new XMLHttpRequest();
	this.method = method;
	this.uri = uri;
	this.reqEntity = reqEntity;
	this.reqHeaders = reqHeaders;
	this.respHeaders = null;
	this.respEntity = null;
	this.timer = null;
	this.respTime = 0;
	
	this.hasReqHeaders = function() {
		return $.isArray( this.reqHeaders ) && this.reqHeaders.length > 0;
	};
	this.hasReqEntity = function() {
		return typeof this.reqEntity == "string" && this.reqEntity.length > 0;
	};
}

//TODO - this should be a member of the AjaxContext Object
function cloneAjaxCtx( ajaxCtx ) {
	var headersCopy = [];

	for (var i = 0; i < ajaxCtx.reqHeaders.length; i++) {
		headersCopy.push({ name:ajaxCtx.reqHeaders[i].name,
			value:ajaxCtx.reqHeaders[i].value});
	}
	var newCtx = new AjaxContext( ajaxCtx.method, ajaxCtx.uri, ajaxCtx.reqEntity, headersCopy );

	return newCtx;
}
/**
 * Create array of header object from text
 * @param headerText
 * @returns {Array}
 */
function textareaHeadersToObject(headerText) {
	var reqHeaders = [];
	if( headerText != "" ) {

		var headerTextArray = headerText.split("\n");
	    for (var i = 0; i < headerTextArray.length; i++) {
	    	var line = $.trim(headerTextArray[i]);
	    	if(line=="" || line.indexOf(":")==-1) {
	    		log.warn("this ain't a header '" +line+ "'. It's either an empty line or has no ':'");
	    		continue;
	    	}
	    	
	    	var name = $.trim(line.substring(0,headerTextArray[i].indexOf(":" )));
	    	var value = $.trim(line.substring(headerTextArray[i].indexOf(":" )+1));

	    	if(!name|| !value) {
	    		log.warn("this ain't a header '" +line+ "'. It's missing a name or value.");
	    		continue;
	    	}
	    	reqHeaders.push({name:name,
	    						value:value});
	    }
	}
	return reqHeaders;
}

function createAjaxCtxFromUI() {
	var method = $("input[name=method_radio]:checked").val();
	var uri = uriAc.val();
	var reqHeaders = textareaHeadersToObject($.trim( headersTa.textarea.val() ));


	var reqEntity = "";
	if($.inArray( method,["PUT", "POST"] ) != -1) {
		reqEntity = $("textarea#put_post_entity").val();
	}

	var ajaxContext = new AjaxContext( method, uri, reqEntity, reqHeaders);

//	var ajaxContext = {
//		xhr: new XMLHttpRequest(),
//		method:method,
//		uri:uri,
//		entity:entity,
//		headers: headers
//	};
	return ajaxContext;
}

/**
 * This method is called when user clicks on the submit button for the URI intput.
 * It gathers all input from the UI including uri, http method, http request
 * headers (optional), and an entity body if the request method is PUT or POST. Once
 * gathered xhr is invoked which calls handleResponse "onreadystatechange".
 *
 */

function handleRequest(ajaxCtx) {
	
    try {
		ajaxCtx.xhr.onreadystatechange = (function(closuredAjaxContext) {
	    	return function() { handleResponse(closuredAjaxContext);};
	    })(ajaxCtx);
    
    	//xhr.open(method, url, async, username, password);
		ajaxCtx.timer = new Timer();
	    ajaxCtx.xhr.open( ajaxCtx.method, ajaxCtx.uri, true );
    	for (var i = 0; i < ajaxCtx.reqHeaders.length; i++) {
    		ajaxCtx.xhr.setRequestHeader(ajaxCtx.reqHeaders[i].name, 
    				ajaxCtx.reqHeaders[i].value);
    	}
    	
        $("div#resp_processing").css("display", "");
        $("#submit_request").button("disable");
        ajaxCtx.xhr.send(ajaxCtx.reqEntity);
    } catch(e) {
    	console.error(e);
    	alert("Error with call, hint: " + e );
    }
}

//I really need to create a chili ext for this!
function formatHeaders( headers ) {
	var headersArr = null;

	if( $.isArray(headers) )
		headersArr = headers;
	else
		headersArr = headers.split( "\n" );

	var fmt = "<div class=\"respFormatting\">";
	for( var i = 0; i < headersArr.length; i++ ) {
		var name = "";
		var value = "";
		if( typeof headersArr[i] == "string" ) {
			var line = $.trim( headersArr[i] );
			if( line == "" )
				continue;
			var index = headersArr[i].indexOf(":")+1;
			//alert(line);
			name = line.substring(0,index );
			value = line.substring( index );
		} else {
			//it must be a header object then...
			name = headersArr[i].name+": ";
			value = headersArr[i].value;
		}
		fmt += "<span><span class=\"respHeaderName\">" + name + "<span class=\"respHeaderValue\">" + value + "</span><br/>";
	}
	fmt += "</div>";
	return fmt;
}

function handleResponse( ajaxContext ) {

	if( ajaxContext.xhr.readyState != 4 ) 
		return;
	
	var elapsed = ajaxContext.timer.elapsed()
	if(log.isDebug)log.debug( "response time timer: " + elapsed );
	var xhr = ajaxContext.xhr;
	var method = ajaxContext.method;
	var uri = ajaxContext.uri;
	var reqHeaders = ajaxContext.reqHeaders;

	//chrome on leopard needs the removeClass
	$("#submit_request").button( "enable" ).removeClass( "ui-state-hover" );
	$("div#resp_processing").css("display", "none");
	if( xhr.status == 0 ) {
		alert( "Please double check your URI, there was no response." );
		return;
	}
	if(xhr.status < 300 ) {
		persistence.storeURI(uri);
		persistence.storeHeaders(reqHeaders);
	}


	var responsesHeader = $("div#main_response_toolbar");
	if( responsesHeader.css("display") == "none" )
		responsesHeader.slideToggle("fast");

//alert( JSON.stringify(newCtx) );
	//create new response div and setup buttons & such
	var newResp = $("div#response_cloner").clone();
	newResp.attr("id","response");

	$("#responses").prepend( newResp );


	newResp.find( "div#title" ).html( xhr.status + " " + method + " " + uri );

	var lock = newResp.find("button#lock").button({
		text: false,
		icons: {
			label:"lock",
			primary: "ui-icon-unlocked"
		}
	}).click( function(event) {
		var options;

		if( $(this).text() == "lock" ) {
			options = {
				label:"unlock",
				icons: {
					primary: "ui-icon-locked"
				}
			}
		} else {
			options = {
				label:"lock",
				icons: {
					primary: "ui-icon-unlocked"
				}
			}
		}
		$(this).button("option",options);
		return false;
	});

	newResp.find('button#expand_collapse_response').button({
		text: false,
		icons: {
			primary: "ui-icon-minus"
		}
	}).click( function(event) {
			var moreInfoButton = $(this).parent().find("button#more");
			var header = $(this).parents("h3#responseHeader");
			var options;

			if( $(this).text() == "collapse" ) {
				moreInfoButton.button("disable");
				header.removeClass("ui-corner-top");
				header.addClass("ui-corner-all");
				//header.attr("state", "closed");
				options = {
					label:"expand",
					icons: { 
						primary: "ui-icon-plus"
					}	
				};
			} else {
				moreInfoButton.button( "enable" );
				header.removeClass("ui-corner-all");
				header.addClass("ui-corner-top");
				//header.attr("state", "open");
				options = {
						label:"collapse",
						icons: { 
							primary: "ui-icon-minus"
						}	
					};
			}
			header.next().slideToggle("fast");
			//alert( JSON.stringify(options) );
			$(this).button("option", options);
			return false;
		}
	);
	newResp.find("button#replay").button({
		text: false,
		icons: {
			primary: 'ui-icon-play'
		}
	}).click( function(event) {
			var newCtx = cloneAjaxCtx(ajaxContext);
			handleRequest( newCtx );
		}	
	);
	newResp.find("button#trashResponse").button({
		text: false,
		icons: {
			primary: 'ui-icon-trash'
		}
	}).click( function(event) {
			event.stopImmediatePropagation();
			var locked = $(this).siblings("button#lock").text() == "unlock";
			if( locked ) {
				alert( "This response is locked. Unlock it if you'd like to trash it." );
			} else {
				var respDiv = $(this).parents("div#response");
				respDiv.remove();
			}
		}	
	);
	newResp.find('button#newwinResponse').button({
		text: false,
		icons: {
			primary: 'ui-icon-newwin'
		}
	}).click( function(event) {
		var clone = $(this).parents("div#response").find("div#response-info").find("pre").clone();
		
		$("<div/>").append(clone).dialog({
			autoOpen: true,
			width: 600,
			height: 400,
			title:  $(this).parents("div#response").find("div#title").text()
		});
	});

	newResp.find('button#save_request_scenario').button({
		text: false,
		icons: {
			primary: 'ui-icon-disk'
		}
		}).click(
		function(event) {
			var name = ajaxContext.method+" "+ajaxContext.uri;
			var reqObj = new Request( name, ajaxContext );
			displayRequestEditor(reqObj,true);
		}).css("display", "");


	//headers response
	//now let's gather the request info for the response formatHeaders( xhr.getAllResponseHeaders() )
	var hasMoreInfo = ajaxContext.hasReqHeaders() || ajaxContext.hasReqEntity();
	if( hasMoreInfo ) {
		newResp.find('button#more').button({
			text: false,
			icons: {
				primary: 'ui-icon-zoomin'
			}
		}).click( function(event) {
				var moreInfo = $(this).parents("div#response").find("div#moreInfoDiv");
				var options;

				if( $(this).text() == "more info" ) {

//					var expColButton = $(this).parent().find("button#expand_collapse_response");
//					
//					
//					if( expColButton.text() == "expand" ) {
//						expColButton.trigger("click");	
//					}

					options = {
						label:"less info",
						icons: { 
							primary: "ui-icon-zoomout"
						}	
					};
				} else {
					options = {
							label:"more info",
							icons: { 
								primary: "ui-icon-zoomin"
							}	
					};
				}
				moreInfo.slideToggle("fast");
				$(this).button("option", options);
				//	return false;
			}
		).css("display", "");
		if( ajaxContext.hasReqHeaders() ) {
			newResp.find( "pre#reqHeadersPre" ).css("display", "");
			newResp.find( "code#reqHeadersCode" ).html( formatHeaders( reqHeaders ) );
		}
		if( ajaxContext.hasReqEntity() ) {
			newResp.find( "pre#reqEntityPre" ).css("display", "");
			newResp.find( "code#reqEntityCode" ).html( htmlify( ajaxContext.reqEntity ) );
		}
		
		//do the select buttons.
		newResp.find("div#reqSelectButtons").prepend("Select: ");
		if(ajaxContext.hasReqHeaders()) {
			newResp.find("button#selectReqHeaders").button().click(
					function() {
						newResp.find( "pre#reqHeadersPre" ).selectText();
					}
			).css("display","");
		}
		if( ajaxContext.hasReqEntity() ) {
			newResp.find("button#selectReqEntity").button().click(
					function() {
						newResp.find( "pre#reqEntityPre" ).selectText();
					}
			).css("display","");
		}
	}//done with more info code. 






	//now let's handle the actual response...
	newResp.find("span#resp-time").html("&nbsp;&nbsp;Response Time: " + elapsed + " milliseconds&nbsp;&nbsp;");
	newResp.find( "code#respHeadersCode" ).html( formatHeaders( xhr.getAllResponseHeaders() ) );
	newResp.find("div#respSelectButtons").prepend("Select: ");
	newResp.find("button#selectRespHeaders").button().click(
			function() {
				newResp.find( "pre#respHeadersPre" ).selectText();
			}
	).css("display","");
	var contentType = xhr.getResponseHeader("Content-Type");
	var entity = xhr.responseText;
    var fmt;
    var chiliClass;
    if(entity != null && entity != "" ) {
    	newResp.find("button#selectRespEntity").button().click(
    			function() {
    				newResp.find( "pre#respEntityPre" ).selectText();
    			}
    	).css("display", "");
    	var entityCode = newResp.find( "code#respEntityCode" );
    	
        try {
    		if (contentType.indexOf("json") != -1) {
    			fmt = JSON.stringify(JSON.parse(entity), null, "\t");
    			chiliClass = "chili-lang-javascript";
    		} else if (contentType.indexOf("xml") != -1) {
    			fmt = formatXml(entity);
    			chiliClass = "chili-lang-xml";
    		} else if (contentType.indexOf("html") != -1) {
    			fmt = entity;
    			chiliClass = "chili-lang-html";
    		} else {
    			fmt = entity;
    		}
    		fmt = htmlify( $.trim( fmt ) );
    		if( typeof chiliClass !== "undefined" ) {
    			entityCode.addClass( chiliClass ).html( fmt ).chili();
    		} else {
    			entityCode.html( fmt );
    		}
    		//newResp.find( "code#respEntityCode" ).addClass( chiliClass ).html( fmt ).chili();
        } catch (e) {
    		console.error( "There was an error trying to format your response entity of content type \"" + contentType + 
    				"\" for response entity \"" + xhr.responseText + "\". Perhaps the server specified a Content-Type doesn't match " +
    				"the response entity? Or, maybe I have a bug!?");
    		entityCode.html( htmlify( $.trim( entity ) ) );
    	}    	
    } else {
    	newResp.find( "code#respEntityCode,#entityHeader" ).css("display", "none");
    }
    newResp.slideToggle("fast");

}//end handleResponse

function htmlify( str ) {
	return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Something wierd... so this method can have both items that are just
 * strings, or items that have labels (like saved requests). If the array
 * of items starts with those that have lables and ends with strings,
 * then all the strings are left out of the autocomplete. But if the
 * strings show up first in the array, everything shows in drop down
 * as expected. 
 */
function awesomeBar( items, request, response) {
	var filteredItems;
	if(request.term=="*") {
		filteredItems = items;
	} else {
		var terms = $.trim( request.term ).split( " " );
		filteredItems = 
			$.map(items, function(item) {
				if( item.label )
					var label = item.label;
				else 
					var label = item;//must be a string


				for( var i = 0; i < terms.length; i++ ) {
					if( label.toLowerCase().indexOf( terms[i].toLowerCase() ) == -1  )
						return;
				}
				//this could return a string or a { label: "label", value: "val" }
				return item;

			});

			//causes suggestions not to show because what the user typed already 
			//matches the single suggestion left.
			if( filteredItems.length == 1 && filteredItems[0] == uriAc.val() )
				filteredItems = new Array();		
	}
	//console.log(filteredItems);
	response(filteredItems);
}
/**
 * I got this code from... 
 * 
 * http://stackoverflow.com/questions/376373/pretty-printing-xml-with-javascript
 * 
 * ...the updated version posted by "Dan BROOKS"
 * 
 * @param xml
 * @returns {String}
 */
function formatXml(xml) {
    var reg = /(>)(<)(\/*)/g;
    var wsexp = / *(.*) +\n/g;
    var contexp = /(<.+>)(.+\n)/g;
    xml = xml.replace(reg, '$1\n$2$3').replace(wsexp, '$1\n').replace(contexp, '$1\n$2');
    var pad = 0;
    var formatted = '';
    var lines = xml.split('\n');
    var indent = 0;
    var lastType = 'other';
    // 4 types of tags - single, closing, opening, other (text, doctype, comment) - 4*4 = 16 transitions 
    var transitions = {
        'single->single': 0,
        'single->closing': -1,
        'single->opening': 0,
        'single->other': 0,
        'closing->single': 0,
        'closing->closing': -1,
        'closing->opening': 0,
        'closing->other': 0,
        'opening->single': 1,
        'opening->closing': 0,
        'opening->opening': 1,
        'opening->other': 1,
        'other->single': 0,
        'other->closing': -1,
        'other->opening': 0,
        'other->other': 0
    };

    for (var i = 0; i < lines.length; i++) {
        var ln = lines[i];
        var single = Boolean(ln.match(/<.+\/>/)); // is this line a single tag? ex. <br />
        var closing = Boolean(ln.match(/<\/.+>/)); // is this a closing tag? ex. </a>
        var opening = Boolean(ln.match(/<[^!].*>/)); // is this even a tag (that's not <!something>)
        var type = single ? 'single' : closing ? 'closing' : opening ? 'opening' : 'other';
        var fromTo = lastType + '->' + type;
        lastType = type;
        var padding = '';

        indent += transitions[fromTo];
        for (var j = 0; j < indent; j++) {
            padding += '\t';
        }
        if (fromTo == 'opening->closing')
            formatted = formatted.substr(0, formatted.length - 1) + ln + '\n'; // substr removes line break (\n) from prev loop
        else
            formatted += padding + ln + '\n';
    }

    return formatted;
}
/**
 * gets or saves an object from/to storage. 
 */
function storageObj( name, value ) {
	//var start = (new Date()).getTime();
	if( typeof value === "undefined" ) {
		var obj = JSON.parse( storage(name) );
		return obj;
	} else
		return storage(name,JSON.stringify(value));
}

/**
 * gets or saves a string from/to storage. 
 */
function storage( name, value ) {
	if( typeof value === "undefined" )//51oojs
		return localStorage.getItem( name );
	try {
		 localStorage.setItem(name, value); //saves to the database, "key", "value"
		 return true;
	} catch (e) {
		 if (e == QUOTA_EXCEEDED_ERR) {
		 	 alert("Sorry, local storage has exceeded it's quota!");
		 	 return false;
		}
	}
}
function selectedText() {
	var selected = "";
	if (window.getSelection) {
		selected = window.getSelection();
	} else if (document.getSelection) {
		selected = document.getSelection();
	} else if (document.selection) {
		selected = document.selection.createRange().text;
	} else {
		return selected;
	}
	return selected;
}

//function editHistory( id, title ) {
//	var histDialog = $("#edit-div-history-cloner").clone().attr("id", id );
//	var contents = histDialog.find("#history");
//	var hist = storageObj(id);
//	var histString = "";
//	for( var i = 0; i < hist.length; i++ ) {
//		histString += hist[i]+"\n";
//	}
//	//alert(histString);
//	contents.val(histString);
//	histDialog.dialog({
//		autoOpen: true,
//		modal: true,
//		width: 700,
//		height: 500,
//		title: title,
//		buttons: { "Save" :
//					   //todo, refactor so header history can reuse some of this code
//					   //do some clean up like ensuring that a real URI is entered and
//					   //that no duplicates are stored
//					   function() {
//							//not sure why i have to do $(contents).text() and not just
//							//contents.text() like above where i set it. w/out the $ the
//							//the .text() call is empty
//							var newText = contents.val();
//							var newTextArray = newText.split("\n");
//							//alert(hist);
//							var newHistory = $.map( newTextArray, function(item) {
//								item = $.trim(item);
//								//should probably check for valid HTTP uri.. will do later
//								if( item != "")
//									return item;
//							});
//
//							storageObj(id, newHistory.sort());
//							histDialog.dialog("close");
//					   },
//					"Cancel":function() {histDialog.dialog("close");}
//				 }
//	});
//}

function loadSavedRequestInUI( nameOrReq, loadOpts ) {

	if(!loadOpts) {//default to load everything
		var loadOpts = {
				method:true,
				uri:true,
				headers:true,
				entity:true
		}
	}
	var touch = true;
	
	if( nameOrReq.name ) {
		var request = nameOrReq;
	} else {
		var request = persistence.locateRequest(nameOrReq,touch);
		if(!request) {
			alert( "Sorry, unable to load request with name '" + nameOrReq + "'. It's likely that cREST has a bug, please report this to the cREST google group. " );
			return;
		}		
	}
		
	
	
	var ajaxCtx = request.ajaxctx;

	//do put/post entity stuff.
	if( loadOpts.entity ) {
		if( loadOpts.entity && ajaxCtx.reqEntity && $.inArray( ajaxCtx.method,["PUT", "POST"] ) != -1 ) {
			$("textarea#put_post_entity").val(ajaxCtx.reqEntity);
		} else {
			$("textarea#put_post_entity").val("");//just clear it out.
		}
	} //else we just leave entity stuff as it was.

	//do method button stuff
	var methods = $("input[name=method_radio]");

	for(var i = 0; i < methods.length; i++) {
		if( methods[i].value == ajaxCtx.method) {
			$(methods[i]).button().trigger("click");
			$(methods[i]).button().trigger("change");
			$(methods[i]).button("refresh");
			break;
		}
	}
	//alert( "setting uri " + ajaxCtx.uri );
	if( loadOpts.uri )
		uriAc.val(ajaxCtx.uri);



	//do header stuff
	if( loadOpts.headers && ajaxCtx.reqHeaders && ajaxCtx.reqHeaders.length > 0 ) {
		var headers = "";
		headers = formatHeadersForTextarea( ajaxCtx.reqHeaders );
		headersTa.textarea.val(headers);
		//only toggle (click) if it's not already open
		if($("input[id=modify_headers]:checked").length==0) {
			$("#modify_headers").button().trigger("click").trigger("change").button("refresh");		
		}
	} else {
		headersTa.textarea.val("");
		//only toggle (click) if it's already open
		if($("input[id=modify_headers]:checked").length>0)
			$("#modify_headers").button().trigger("click").trigger("change").button("refresh");
	}
	
	return request;
}
var uriAc;
var headerAc;
var headersTa;
var putPostEntityTa
var savedReqURIOverride;
var persistence = new Persistence().init();
var storeTabs;


function init(){

	//setup uri fields...
	$("div#submit_request_buttonset").buttonset();

	/*
	 * Sup with all the bind/unbind in the focus event? I only want to capture mouse up
	 * once per focus. So i bind a handler in focus event. To prevent
	 * multiple mouseup handlers on focus event, the mouseup handler
	 * needs to unbind itself. What i aim to do here is select all text
	 * in the text field on the initial focus only if the user has not
	 * selected text.
	 * 
	 * 
	 * 
	 * NOTE: see http://api.jquery.com/unbind/ and http://api.jquery.com/bind on using namespaces for events. Calling unbind("mouseup") will
	 * remove all mouseup events, but if i bound it with a namesapce - like mouseup.focus - i can remove just the one mouseup handler using
	 * its namespace
	 */
	uriAc = $("#uri_autocomplete").autocomplete( {
			source: function(req, resp){
					
					//{ label: lab, value: val };
					var names = persistence.listRequestNames();
					var nameObjs = [];
					for(var i = 0; i < names.length; i++) {
						nameObjs[i] = { label: names[i], value: names[i], crestType:"savedReq" }
					}
					
					var uris = [];
					var newTerm = getSavedCommandTerm(req.term);
					if(newTerm!=null) {//this means someone only wants to see saved requests in dropdown
						req.term = newTerm;
						uris = nameObjs;
					} else {
						var uris = persistence.listURIs().concat(nameObjs);	
					}
					//see doc for awesomeBar - the uris array must always have string
					//history before objects with labels
					awesomeBar(uris, req, resp);
			},
			select: function(event, ui){
				if(ui.item && ui.item.crestType == "savedReq") {
					var reqItem = loadSavedRequestInUI( ui.item.value );
					savedReqURIOverride = reqItem.ajaxctx.uri;		
				}
			},
			close: function(event, ui) {
				if( savedReqURIOverride ) {
					$(this).val(savedReqURIOverride);
					savedReqURIOverride=null;
				}
			},
			minLength: 2} 
		).bind( "mouseup.uriparamcheck", function() {

				var range = $(this).getSelection();
				var val = $(this).val();

				if( range.start != range.end )
					return;//only apply if user clicked w/out selecting text
//				
//				var left = val.substring( 0,range.start ).lastIndexOf("{");
//				var right = val.substring( range.start ).indexOf("}");
//				if( left == -1 || right == -1 )
//					return;
//				
//				//okay, now we know we need to select a range case we have a { to the left of the cursor and a } to the right.
				var selStart = -1;
				for( i = range.start; i > -1; i-- )
					if( val.charAt(i) == "/" )
						break;
					else if( val.charAt(i) == "{" ) {
						selStart = i;
						break;
					}
				var selEnd = -1;
				for( i = range.start; i < val.length; i++ )
					if( val.charAt(i) == "/" )
						break;
					else if( val.charAt(i) == "}" ) {
						selEnd = i;
						break;
					}	

				if( selStart != -1 && selEnd != -1 )
					$(this).selectRange(selStart,selEnd+1);

			}
		).focus(function(){
			$(this).bind( "mouseup.focus",function(){

				if( selectedText() == "" )
					$(this).select();
				$(this).unbind( "mouseup.focus" );
			});

		}).keypress(function(e) {
		    if(e.keyCode == 13)
		    	$("#submit_request").button().trigger("click");
		});


	$("#submit_request").button({
		text: true,
		icons: {
			//primary: 'ui-icon-play',
			//secondary: 'ui-icon-play'
		}
	}).click(
			function(){
				var val = uriAc.val();
				if(crestCommandExp.test(val)) {
					handleRequestCommand(val);
					return;
				}
				
				var req = persistence.locateRequest(val, false);
				if(req) {
					loadSavedRequestInUI( req );
				}
				handleRequest(createAjaxCtxFromUI());
				return false;
			}
	  );
	$('button#edit_uri_history').button({
		text: false,
		icons: {
			primary: 'ui-icon-pencil'
		}
	}).click(function() {
		storeTabs.find("a#edit-uri-history-tab").trigger("click");
		displayRequestStore();
	});//click


	//setup header fields...
	$("div#header-autocomplete_buttonset").buttonset();

	headerAc = $("#header-autocomplete").autocomplete( {
		source: function(req, resp){
			
			//create a list of saved request names for awesomeBar use...
			var names = persistence.listRequestNames();
			var nameObjs = [];
			for(var i = 0; i < names.length; i++) {
				nameObjs[i] = { label: names[i], value: names[i], crestType:"savedReq" }
			}
			
			var filteredHeaderHist = [];
			var newTerm = getSavedCommandTerm(req.term);
			if(newTerm!=null) {//this means someone only wants to see saved requests in dropdown
				req.term = newTerm;
				filteredHeaderHist = nameObjs;
			} else {//else we show header history and saved requests in qutocomplete.
				var alreadySelected = headersTa.textarea.val();
				var headerHist = persistence.listHeaders();
				
				//remove autocomplete items that are already selected in the textarea.
				filteredHeaderHist = $.map(headerHist, function(item) {
					if( alreadySelected.indexOf(item) != -1 )
						return;

					return item;//not already selected.
				}).concat(nameObjs);
			}
			//see doc for awesomeBar - the filteredHeaderHist array must always have string
			//history before objects with labels
			awesomeBar( filteredHeaderHist, req, resp);

		},
		minLength: 2, 
		select: function(event,ui) {
			var currentLines = headersTa.textarea.val();
			//called when a req name is chosen not an individual header.
			if(ui.item && ui.item.crestType == "savedReq") {
				console.log("ui.item.value: " + ui.item.value );
				var req = persistence.locateRequest(ui.item.value);
				var headers = req.ajaxctx.reqHeaders;
				var newLines = "";
				for(var i=0;i<headers.length;i++) {
					var line = headers[i].name + ": " + headers[i].value
					if(currentLines=="" || currentLines.indexOf(line) == -1)
						newLines+=line+"\n";
				}
				//clear the name out
				$("#header-autocomplete").data("clearIt",true);
				console.log("one: ");
				console.log( $("#header-autocomplete").data().clearIt );
			} else {//put selected value in headers text area when it's selected from drop down
				var newLines = ui.item.value+"\n";
			}
			
			
			if(currentLines!="" && !/\n$/.test(currentLines))
				currentLines+="\n";
			
			
			//this causes a bug when you add to the textarea delete, and then try 
			//to add additional headers. So i repla
			//headersTa.textarea.text( currentLines ).append(newLines);
			var lines = currentLines+newLines;
			headersTa.textarea.val(lines);
		
			
			headersTa.checkExpand();
		},
		close: function(event,ui) {
			//when autocomplete drop down closes, see if the value in the autocomplete field
			//is found in the text area, if so, remove it from the autocomplete <input> since it was
			//already added. If it's not in text area, user must have look at the drop down and
			//not selected anything (like clicking elsewhere on the page or pressing esc).
			//var headersArea = $("textarea#request_headers").val();
			var headersArea = headersTa.textarea.val();
			if( headersArea.indexOf($("#header-autocomplete").val()) != -1 )
				$("#header-autocomplete").val("");
			else if($("#header-autocomplete").data().clearIt) {
				console.log( "Clearing it..." );
				$("#header-autocomplete").data().clearIt=false;
				$("#header-autocomplete").val("");
			}
		}
	}
	);

	$("#add_header").button().click(
			function(){
				var acValue = $("#header-autocomplete").val();
				var req = persistence.locateRequest(acValue, false);
				var currentLines = headersTa.textarea.val()
				if( req ) {
					var headers = req.ajaxctx.reqHeaders;
					var newLines = "";
					for(var i=0;i<headers.length;i++) {
						var line = headers[i].name + ": " + headers[i].value+"\n";
						if(currentLines=="" || currentLines.indexOf(line) == -1)
							newLines+=line;
					}
				} else
					newLines = acValue;
				//see comment for "select" event above for why i'm doing text(val()) call
				headersTa.textarea.text( currentLines ).append(newLines).append("\n");
				$("#header-autocomplete").val("");
				headersTa.checkExpand();
				return false;
			}
	  );

	$('button#edit_header_history').button({
		text: false,
		icons: {
			primary: 'ui-icon-pencil'
		}
	}).click(function() {
		storeTabs.find("a#edit-header-history-tab").trigger("click");
		displayRequestStore();
	});//click

	$("button#reset_request_builder").button({
		text: false,
		icons: {
			primary: 'ui-icon-home'
		}
	}).click(function() {
		loadSavedRequestInUI(persistence.getHomeRequest());
//		var getButton = $("input#method_get").button();
//		getButton.trigger("click").trigger("change").trigger("refresh");
//		uriAc.val("");
//		headerAc.val("");
//		headersTa.textarea.val("");
//
//		if( $("div#modify_headers").css("display") != "none")
//			$("input#modify_headers").trigger("click").trigger("change").trigger("refresh");
//
//		putPostEntityTa.val("");
	});
	
	$("button#help_page").button({
		text: false,
		icons: {
			primary: 'ui-icon-help'
		}
	}).click(function() {
		document.location = "/help.html";
	});
	$("button#req_store").button({
		text: false,
		icons: {
			primary: 'ui-icon-folder-open'
		}
	}).click(function() {
		storeTabs.find("a#load-request-tab").trigger("click");
		displayRequestStore();
	});
	
	$("input#modify_headers").button().click(function() {
		$("div#modify_headers").slideToggle("fast");
	});

	$("#requestBuilderToolbar").buttonset();
	$("input[name=method_radio]").change(function() {
		var checked = $("input[name=method_radio]:checked").val();
		putPostDiv = $("#put_post_entity_div");
		var invisible = putPostDiv.css("display") == "none";
		if($.inArray(checked,["PUT","POST"] ) != -1 ) {//if put or post, make it visible if not already
			if(invisible)
				putPostDiv.slideToggle("fast");
		} else if( !invisible )//not put or post, so make invisible if not already
			putPostDiv.slideToggle("fast");
	});

	$('button#only-responses').button({
		text: false,
		icons: {
			primary: 'ui-icon ui-icon-carat-2-n-s'
		}
	}).click(function() {
		$("#requestBuilder").slideToggle('fast');
	});


	$('button#collapse-all').button({
		text: false,
		icons: {
			primary: 'ui-icon-minus'
		}
	}).click(function() {
		var buttons = $("button#expand_collapse_response");
		for(var i = 0; i < buttons.length; i++ ) {
			var button = $(buttons[i]);
			if( button.text() == "collapse")
				button.trigger("click");
		}
	});
	$('button#expand-all').button({
		text: false,
		icons: {
			primary: 'ui-icon-plus'
		}
	}).click(function() {
		var buttons = $("button#expand_collapse_response");
		for(var i = 0; i < buttons.length; i++ ) {
			var button = $(buttons[i]);
			if( button.text() == "expand")
				button.trigger("click");
		}
	});

	$('button#trash-all').button({
		text: false,
		icons: {
			primary: 'ui-icon-trash'
		}
	}).click(function() {
		//$("div#response").remove();
		//$($("div#response")[0]).find("button#lock")

		var responses = $("div#response");
		for( var i = 0; i < responses.length; i++ ) {
			var response = $(responses[i]);
			if( response.find("button#lock").text() == "lock" )
				response.remove();

		}
	});
	headersTa = $("textarea#request_headers").autogrow();
	putPostEntityTa = $("textarea#put_post_entity");

	storeTabs = $("#load-edit-tabs");
	
	storeTabs.tabs().bind("tabsselect", function(event, ui) {
		enableDisableDiv();//adjust the disable div if height is different for tab.
	});
	storeTabs.find("button#load-edit-tabs-close").button({
		text: false,
		icons: {
			primary: 'ui-icon-close'
		}
	}).click( function(e) {
		var uriChange = startsWithStarExp.test(storeTabs.find("a#edit-uri-history-tab").text()); 
		var headerChange = startsWithStarExp.test(storeTabs.find("a#edit-header-history-tab").text()); 

		
		if(uriChange || headerChange ) {
			
			if(uriChange && headerChange )
				var msg = "URI history and header history have been modified. Save changes?";
			else if (uriChange)
				var msg = "URI history has been modified. Save changes?";
			else
				var msg = "Header history has been modified. Save changes?";
			
			//wierd, w/out the clone, the dialog will only show once on close
			storeTabs.find( "div#req-store-save-confirm" ).clone().append(msg).dialog({
				resizable: false,
				height:140,
				modal: true,
				buttons: {
					"Yes": function() {
						if(uriChange)
							storeTabs.find("button#uri-history-save").trigger("click");
							
						if(headerChange)
							storeTabs.find("button#header-history-save").trigger("click");
						
						$( this ).dialog( "close" );
						closeRequestStore();
					},
					"No": function() {
						
						$( this ).dialog( "close" );
						closeRequestStore();
					}
				}
			});
			
		} else
			closeRequestStore() 
	});
	
	storeTabs.find("button#uri-history-save").button().click(function() {
		var ta = storeTabs.find("textarea#uri-history");
		var uriHist = ta.val()
		uriHist = toArrayFromLines(uriHist);
		var replaceAll = true;
		persistence.storeURIs(uriHist,replaceAll);
		removeStarFromText(storeTabs.find("a#edit-uri-history-tab"));
		//get ready for next change now
		bindReqStoreTextareaEvents(ta);
	});
	
	storeTabs.find("button#header-history-save").button().click(function() {
		var ta = storeTabs.find("textarea#header-history");
		var headerHist = ta.val()
		headerHist = toArrayFromLines(headerHist);
		var replaceAll = true;
		persistence.storeHeaders(headerHist,replaceAll);
		removeStarFromText(storeTabs.find("a#edit-header-history-tab"));
		bindReqStoreTextareaEvents(ta);
	});
}
var gStarReplaceExp = /\*/g;
var startsWithStarExp = /^\*/;
var crestCommandExp = /^crest\./;
var crestCommandSaved = /^crest\.saved:/;

/**
 * 
 * @param term - the whole string as typed in autocomplete field
 * @returns - null if no saved command is found ("crest.saved:") or
 * a new term if a saved command is found. The new term will be the
 * contents of the autocomplete minus "crest.saved:". If we see the
 * command and the new term is empty string, the new term will be
 * "* 
 */
function getSavedCommandTerm(term) {
	var newTerm = null;
	if(crestCommandSaved.test(term) ) {
		newTerm = term.split(crestCommandSaved)[1];
		newTerm = (newTerm == "") ? "*":newTerm;
	}
	return newTerm;
}

function removeStarFromText(jqObj) {
	jqObj.text(jqObj.text().replace(gStarReplaceExp,""));
}

var disableDiv;
function enableDisableDiv() {
	if(!disableDiv)
		disableDiv = $("div#screen-disable");

	disableDiv.height($(document).height()+300);
	disableDiv.css("display","block");
	return parseInt(disableDiv.css("z-index"))+1;//give caller's a z-index on top of this one
}
function loadAndCloseRequestStore(name) {
	var loadOpts = {
			uri:$("input[id=load_uri]:checked").length>0,
			headers:$("input[id=load_headers]:checked").length>0,
			entity:$("input[id=load_entity]:checked").length>0
	}
	closeRequestStore();
	loadSavedRequestInUI(name);			
}
function closeRequestStore() {
	storeTabs.css( "display", "none" );
	disableDiv.css( "display", "none" );
}
/**
 * TODO - performance isn't great when i tested with a couple hundred saved items. around 300ms
 * 
 * 
 */
function displayRequestStore() {
	var timer = new Timer();
	//handle saved requests tab...
	var savedReqs = storeTabs.find("#load-request");
	var names = persistence.listRequestNames();
	var itemList = savedReqs.find( "div#items" );
	itemList.empty();//remove everything then build the list back up...
	
	
	itemList.append(createSavedReqForReqStore(persistence.getHomeRequest().name,true));
	itemList.append("<br/>");
	
	for(var i = 0; i < names.length; i++ ) {//saved request items...
		var item = createSavedReqForReqStore(names[i]);
		itemList.append(item);
	}//saved request item loop	
	removeStarFromText(storeTabs.find("a#edit-uri-history-tab"));
	var uris = persistence.listURIs();
	var uriTA = $("textarea#uri-history").val("").unbind().data("bound",false);
	
	var uriLines = toLines(uris); 
	uriTA.val(uriLines);
	
	removeStarFromText(storeTabs.find("a#edit-header-history-tab"));
	var headers = persistence.listHeaders();	
	var headerHistTA = $("textarea#header-history").val("").unbind().data("bound",false); 
	
	var headerLines = toLines(headers); 
	headerHistTA.val(headerLines);
	
	bindReqStoreTextareaEvents();
	
	if(names.length==0)
		itemList.append("You should save some requests so you have some stored.");
	
	storeTabs.css( "display", "block" );
	var oneAbove = enableDisableDiv();
	storeTabs.css("z-index",oneAbove);
	//this is pretty slow and not cause of localStorage, jQuery is doing a lot up there when there's
	//a lot of items. I'll figure out a better way to handle this later, for now it works.
	if(log.isDebug)log.debug("Time taken to display saved data tabs: " + timer.elapsed() + " millis for " + names.length + " items.");
}

function createSavedReqForReqStore(name,home) {
	var item = $("<div class='ui-widget-content ui-corner-all' style='cursor: default;padding-left: 2px; padding-top:7px; padding-bottom:7px;margin-bottom:5px;'></div>");
	//if(log.isDebug)log.debug( "adding name '" +names[i]+ "' to the request store" );
	
	
	var itemName = $("<pre id='req-store-req-name' style='border:0px solid black;' class='saved' />").text(name);
	var hiddenName = $("<input id='item-name' type='hidden'/>").val(name);//SOR
	itemName.append(hiddenName);
	
	var itemButtonsLeft = $("<div style='top:-4px;position:relative;float:left;padding-right:4px;'></div>");
	
	if(home==true) {
		itemName.attr("id","home-request-item");
		var homeButton = $("<button style='padding:0px;margin:0px;margin-left:2px;'>Home</button>").button({
			text: false,
			disabled:true,
			icons: {
				primary: 'ui-icon-home',
			}
		});
		itemButtonsLeft.append(homeButton);
		item.append( itemButtonsLeft );
		item.append( itemName.prepend("Home Request: ") );
//		if(persistence.getHomeRequest().isDefault == true) {
//			item.append("<br/>Note: You can use any saved request for your home request by clicking the home button next to it. The default request effectively resets the request builder with the GET method. It has no URI, headers, or entity. ");
//		}
		return item;
	} else {
		var runButton = $("<button style='padding:0px;margin:0px;margin-left:2px;'>Load and Run</button>").button({
			text: false,
			icons: {
				primary: 'ui-icon-play'
			}
		}).click(
				function() {
					loadAndCloseRequestStore( $(this).parent().parent().find("input#item-name").val() );
					$("#submit_request").trigger("click");
				});
		
		var loadButton = $("<button style='padding:0px;margin:0px;margin-left:2px;'>Load</button>").button({
			text: false,
			icons: {
				primary: "ui-icon-arrowreturnthick-1-n"//'ui-icon-folder-open'
			}
		}).click(
				function() {
					loadAndCloseRequestStore( $(this).parent().parent().find("input#item-name").val() );
				});
		
		var homeButton = $("<button style='padding:0px;margin:0px;margin-left:2px;'>Make me the home request.</button>").button({
			text: false,
			icons: {
				primary: "ui-icon-home"//'ui-icon-folder-open'
			}
		}).click(
				function() {
					var newName = $(this).parent().parent().find("input#item-name").val();
					var home = $(this).parent().parent().parent().find("#home-request-item");
					persistence.changeHomeRequest(newName);
					home.text("Home Request: " + newName);
					
		});
 
		var copyButton = $("<button style='padding:0px;margin:0px;margin-left:2px;'>Copy</button>").button({
			text: false,
			icons: {
				primary: 'ui-icon-copy'
			}
		}).click(
				function() {
					var rname = $(this).parent().parent().find("input#item-name").val();
					var req = persistence.locateRequest(rname, false);
					var cname = rname+" copy";
					if( persistence.locateRequest( cname, false) ) {
						for(var i = 2; true; i++) {
							cname = rname+" copy "+i;
							if( !persistence.locateRequest( cname, false) )
								break;
						}
					}
					
					var reqObj = new Request( cname, req.ajaxctx );
					displayRequestEditor(reqObj,true);
				});
		
		var editButton = $("<button style='padding:0px;margin:0px;margin-left:2px;'>Edit</button>").button({
			text: false,
			icons: {
				primary: 'ui-icon-pencil'
			}
		}).click(
				function() {
					displayRequestEditor($(this).parent().parent().find("input#item-name").val(),false);
				});
		
		var deleteButton = $("<button style='padding:0px;margin:0px;margin-left:2px;'>Trash</button>").button({
			text: false,
			icons: {
				primary: 'ui-icon-trash'
			}
		}).click(
				function() {
					var success = persistence.removeRequest($(this).parent().parent().find("input#item-name").val());
					if(!success) {
						alert("Sorry. Unable to remove request named " + this.id );
						return;
					}
					$(this).parent().parent().remove();
				});
		
		itemButtonsLeft.append(runButton).append(loadButton).append(homeButton).append(copyButton).append(editButton);
		item.append( itemButtonsLeft );
		item.append( itemName );
		var itemButtonsRight = $("<div style='border:0px solid black; top:-17px;position:relative;float:right;padding-right:3px;'></div>");
		itemButtonsRight.append(deleteButton);
		item.append(itemButtonsRight);
		item.dblclick(function (){
			loadAndCloseRequestStore( $(this).find("input#item-name").val() );
		}).mouseover(function () {
		    $(this).css("background", "#ACDD4A");
		    //$(this).css("font-weight", "bold");
		  }).mouseout(function () {
		    $(this).css("background", "");
		    //$(this).css("font-weight", "");
		  });
		return item;
	}
}

function handleRequestCommand(command) {
	var cmd = command.split(crestCommandExp);
	console.log(cmd);
	if(cmd[1].indexOf("eval=")!=-1) {
		var evalExp = cmd[1].split("eval=")[1]
		console.log(evalExp);
		eval(evalExp);
	}
		
	
}
/*
 * used in two places, once during reqStore show, and then again after someone clicks save. This
 * avoids handling the event while * is already shown.
 * 
 * Always need an array here to use $() when passing TA to this method
 * 
 * This method is used to detect changes for staring
 */
function bindReqStoreTextareaEvents(ta) {
	if(ta) {
		var subjects = ta;
	} else var subjects = storeTabs.find("textarea");
	

	for(var i = 0; i < subjects.length; i++ ) {
		var subject = $(subjects[i]);
		if(! subject.data("bound") ) {
			if(log.isDebug)log.debug( "binding text area events for req store: ", subject );
			subject.bind("paste cut keypress keydown", function(e) {
				if(log.isDebug)log.debug( "EVENT type '" + e.type + "' for '" +e.srcElement.id+ "'", e);
				
				/* keypress only picks up pritable chars so keydown is attached, but since
				 * keydown is trigged for all keys, we want to make sure we only add a *
				 * for keydowns we care about. We don't care about tab or esc, but we do care
				 * about delete (8)... what others??
				 */
				if(e.type=="keydown") {
					if(e.which !=8 )//8 == delete
						return;
				}
					
				
				if(e.srcElement.id=="uri-history") {
					storeTabs.find("a#edit-uri-history-tab").prepend("*");
				} else if(e.srcElement.id=="header-history") {
					storeTabs.find("a#edit-header-history-tab").prepend("*");
				} else {
					log.error("Recieved an unexpected event for for req store *s",e);
				}
				$(this).data("bound",false);
				$(this).unbind();
			});
			subject.data("bound",true);		
		} else {
			if(log.isDebug)log.debug( "text area was already bound already bound:", subject );
		}
	}
}

function toArrayFromLines(lines) {
	lines = lines.split("\n");
	//alert(hist);
	var newlines = $.map( lines, function(item) {
		item = $.trim(item);
		if( item != "")
			return item;
	});
	return newlines;
} 

function formatHeadersForTextarea( headersObj ) {
	var headers = "";
	for(var i = 0; i < headersObj.length; i++) {
		headers = headers+headersObj[i].name+": "+headersObj[i].value+"\n";
	}
	return headers;
}

function toLines(strArr) {
	var txt = "";
	for(var i = 0; i < strArr.length; i++) {
		txt = txt+strArr[i]+"\n";
	}
	return txt;
}

function toUniqueArray(a){
	a.sort();
	for(var i = 1;i < a.length;){
		if(a[i-1] == a[i]){
			a.splice(i, 1);
		} else {
			i++; 
		}
	}
	return a;
}


var devMode = false;
$(window).load(function() {
	init();	

	if(devMode) {
		//$.getScript("js/devMode.js"); - uses async so other stuff that depends on it fails!
		$.ajax({
			  url: "js/devMode.js",
			  dataType: "script",
			  async: false
			});
	}
});

/**
 * We'll either display the editor for saving new requests, or editing 
 * old ones. if isNew == true, well, let's just say we're not editing
 * an old one.
 * @param req - either a string or Request object. If string, then we'll look
 * up the Request obj from persistence.
 * @param isNew - indicates weather the request is new one to save, or if we're
 * editing an existing saved request. If editing, we don't need to warn the user
 * for duplication name, we'll just overrite. For new ones, we should warn the
 * user.
 */
function displayRequestEditor(req,isNew) {

	if( typeof req == "string" ) {//req must be a name.
		var name = req;
		req = persistence.locateRequest(req, false);
		if(log.isDebug)log.debug("displayRequestEditor looked up request object for name '"+name+"' and found:",req);
	}
	(function(closuredReq,isNew){//i need to reference the req in the save function (for method) so this keeps the req in scope... guess i could put in in a hidden field.
		var isEdit = !isNew;//just to be explicit... if it's not new, it must be an edit to an exiting one.
		
		if(log.isDebug)log.debug( "displayRequestEditor invoked with Request named '" + closuredReq.name + "' and isNew = "+isNew+". Here's the whole object", closuredReq );
		var saveInput = $("div#save-request-input-cloner").clone();
		saveInput.attr("id","new-save-request-input-cloner");//ensures we only do things with the clone
		
		function createRequestFromEditor() {
			var name = $.trim(saveInput.find("input#save-request-input-name").val());
			var uri = saveInput.find("input#save-request-input-uri").val();
			var reqHeaders = $.trim(saveInput.find("textarea#save-request-headers").val());
			var reqEntity = saveInput.find("textarea#save-request-put_post_entity").val();
			var method = saveInput.find("#method-select option:selected").val();
			
			var newCtx = new AjaxContext(
					method, uri, reqEntity, textareaHeadersToObject(reqHeaders));
			var newReq = new Request( 
					name,
					newCtx);
			
			return newReq;
		}
	
	
		//saveInput.find("input#save-request-input-name").val(method+" "+uri);
		saveInput.find("input#save-request-input-name").val(closuredReq.name);
		saveInput.find("input#save-request-input-uri").val(closuredReq.ajaxctx.uri);
		saveInput.find("textarea#save-request-headers").val( formatHeadersForTextarea(closuredReq.ajaxctx.reqHeaders) );
		saveInput.find("textarea#save-request-put_post_entity").val(closuredReq.ajaxctx.reqEntity);
		
		saveInput.find("#method-select option:selected").removeAttr("selected");
		saveInput.find("#method-select option[value="+closuredReq.ajaxctx.method+"]").attr("selected","selected");
		
		
//		$('#'+select_id+' option:selected').removeAttr('selected');
//	    $('#'+select_id+' option[value='+option_val+']').attr('selected','selected');
		$(saveInput).dialog(
				{
					autoOpen: true,
					modal: true,
					width: 700,
					height:600,
					title: "Request Editor",
					buttons: { "Save" :
								   function() {
										var reqFromEditor = createRequestFromEditor();
										var name = reqFromEditor.name;
										if(!$.trim(name)) {
											alert("Please name this request.");
											return;
										}
										var btnArea = $($(this).parent().find("button").parent());
										var saveSpan = $(btnArea.find("button")[0]).find("span");
										var cancelSpan = $(btnArea.find("button")[1]).find("span");
										
										//setup booleans to use with if statements so i don't keep getting confused...
										var isEditWithRename = (isEdit && closuredReq.name != name);
										var isReqInStore = (persistence.locateRequest( reqFromEditor.name )) ? true:false;
										var isSaveButton = saveSpan.text()=="Save";
										var isYesButton = saveSpan.text()=="Yes";
										
										if(log.isDebug) log.debug( "Save pressed. isNew: " + isNew + " isEditWithRename: " + isEditWithRename + " isReqInStore: " + isReqInStore + " isSaveButton: " + isSaveButton + " isYesButton: " + isYesButton );
										//if (it's a new request being save) and if (if the request exists) and if (no duplicate warning has been seen), show the warning
										
										
										if( (isSaveButton && isReqInStore) && ((isNew) || (isEditWithRename)) ) {
											if(log.isDebug) {
												if(isNew)log.debug("Save button pressed for new request but the name already exists.");
												if(isEditWithRename)log.debug("Save button pressed for edit with rename but the renamed name already exists.")
											}
//										if( (isNew && persistence.locateRequest( name ) && saveSpan.text()=="Save") || 
//											(isEdit && closuredReq.name != name && persistence.locateRequest( name ) && saveSpan.text()=="Save") ) {
											if(log.isDebug)log.debug( "NEW Request already exists with name '" +name+ "'. I'm gonna present a warning message and repurpose the buttons to confirm overwrite" );
											var errmsg = $("div#error-msg-cloner").clone().attr("id","new-error-msg-cloner");
											errmsg.find("p#msg").append("An item with that name exists, would you like to overwrite it?&nbsp;&nbsp;");
											saveSpan.text("Yes");
											cancelSpan.text("No");
											btnArea.prepend(errmsg.css("float","left").css("margin","6px").css("border","1px solid black"));
											errmsg.css("display","")
										//else the user must want to overwrite, or is editing an existing request (also overwrite)
										} else if( isYesButton || isEdit ) {
											if(log.isDebug) log.debug( "User chose to overwrite or update existing request with name: '" +name+ "'" );
											
											if(isEditWithRename) {//they either edited it to a new name, or chose an existing name.
												if(isReqInStore) {//okay, so they renamed one to a name that exists, so remove the old one with the same name
													if(log.isDebug)log.debug( "saving an edit with rename. new name DID exist, removing..." );
													persistence.removeRequest(reqFromEditor.name);
												} else if(log.isDebug)log.debug( "saving an edit with rename. new name did NOT exist" );
												
												//the second name param causes replaceRequest to look for that name to 
												//replace, not the one on req which much have been renamed in the editor
												persistence.replaceRequest(reqFromEditor, closuredReq.name);
												
												//re-init the req store so the new one shows up. I first tried to just edit what's showing
												//but event handlers got messed up and i was too lazy to dig into it. Thi'll work for now.
												displayRequestStore();

											} else {
												if(log.isDebug)log.debug( "Saving new request with existing name, or saving edited request w/out name change." );
												persistence.replaceRequest(reqFromEditor);
												//if req store is showing and the name doesn't already exist
												if(storeTabs.css("display")=="block" && !isReqInStore) {
													var items = storeTabs.find( "div#items")
													var newItem = createSavedReqForReqStore(name);
													items.append(newItem);
												}
											}
											
											saveInput.remove();
										} else { //totally new name so just save it.
											if(log.isDebug) log.debug( "Editor Storing totally new request with name '" +name+ "'" );
											persistence.storeRequest(reqFromEditor);
											if(storeTabs.css("display")=="block") {
												var newItem = createSavedReqForReqStore(reqFromEditor.name);
												var names = storeTabs.find( "input#item-name");
												var inserted = false;
												//start at 1 so home button row isn't included
												for(var i = 1; i < names.length; i++) {
													var obj = $(names[i]);
													var lowerName = reqFromEditor.name.toLowerCase();
													if(obj.val().toLowerCase()>lowerName) {
														obj.parent().parent().before(newItem);
														console.log( "obj.parent().parent().before(newItem) with newItem: " );
														console.log(newItem);
														inserted=true;
														break;
													}
												}
												if(!inserted) {
													console.log( "Appending to the end" );
													var items = storeTabs.find( "div#items");	
													items.append(newItem);
												}
											}
											saveInput.remove();
										}
								   },
								"Cancel":function() {
									var btnArea = $($(this).parent().find("button").parent());
									var saveSpan = $(btnArea.find("button")[0]).find("span");
									var cancelSpan = $(btnArea.find("button")[1]).find("span");
									
									
									if(cancelSpan.text()=="No") {
										if(log.isDebug) log.debug( "User chose NOT to overwrite existing request with name '" +name+ "'" );
										btnArea.find("div#new-error-msg-cloner").remove();
										saveSpan.text("Save");
										cancelSpan.text("Cancel");
									} else {//must have already been a cancel button, so close the shit down.
										saveInput.remove();	
									}
								}
							 }
				}					
		);
		saveInput.find("input#save-request-input-name").blur();
	})(req,isNew);
	//saveInput.siblings(".ui-dialog-titlebar").hide();
}

function rawSavedRequests() {
	var raw = storage( persistence.reqStoreKey );
	var popup = $("div#edit-div-history-cloner").clone().attr("id","newid");
	popup.find("textarea").val(raw);
	
	popup.dialog({
				autoOpen: true,
				modal: true,
				width: 700,
				height:600,
				title: "<i>Saved Requests</i> JSON"
			});
}
function commands() {
	console.log("rawSavedRequests() - this will popup a textarea containing all your saved requests in JSON format. I use it to copy them over to another computer with the cREST on it. To do this just copy the JSON from the textarea, and in the console of your target cREST client, put: persistence.storeRequestsAndNames(yourJSON). This will overwrite the saved requests with the contents of yourJSON.");
}
function setupTestButton() {
	var name = "simple";
	var req = persistence.locateRequest(name);

//	var req = persistence.locateRequest("WADL post <b>with</b> customer          header        this name has     space");
	var ajaxContext = req.ajaxctx;
	$("button#tester").button({
		text: false,
		icons: {
			primary: 'ui-icon-disk'
		}
		}).click(function(event) {alert("a button just for testing, so put some code here.")});
	
}

//http://stackoverflow.com/questions/985272/jquery-selecting-text-in-an-element-akin-to-highlighting-with-your-mouse
jQuery.fn.selectText = function() {
    var obj = this[0];
    if ($.browser.msie) {
        var range = obj.offsetParent.createTextRange();
        range.moveToElementText(obj);
        range.select();
    } else if ($.browser.mozilla || $.browser.opera) {
        var selection = obj.ownerDocument.defaultView.getSelection();
        var range = obj.ownerDocument.createRange();
        range.selectNodeContents(obj);
        selection.removeAllRanges();
        selection.addRange(range);
    } else if ($.browser.safari) {
        var selection = obj.ownerDocument.defaultView.getSelection();
        selection.setBaseAndExtent(obj, 0, obj, 1);
    }
    return this;
}


//http://stackoverflow.com/questions/2010892/storing-objects-in-html5-localstorage
//Storage.prototype.setObject = function(key, value) {
//    this.setItem(key, JSON.stringify(value));
//}
//
//Storage.prototype.getObject = function(key) {
//    return this.getItem(key) && JSON.parse(this.getItem(key));
//}