function loadFile(url, callback){
    var request = new XMLHttpRequest();
    request.overrideMimeType("text/plain");
    request.open('GET', url, true);

    request.onreadystatechange = function (){
        if (request.readyState == 4){
            if (request.status == 200){
                callback(request.responseText);
            } else {
				console.error("File is sad ("+request.status+"): "+url);
            }
        }
    };

    request.send();
}