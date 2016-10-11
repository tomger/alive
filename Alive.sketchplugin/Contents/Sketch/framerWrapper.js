@import "framer.js"

var debugConfig = {
  url: 'http://127.0.0.1:3001/upload',
  projectUrl: 'http://127.0.0.1:3000/edit/',
  debug: true
};

var releaseConfig = {
  url: 'http://alive.iterator.us/upload',
  projectUrl: 'http://alive.iterator.us/edit/',
  debug: false
};

// var config = debugConfig;
var config = releaseConfig;

function open(context) {
  var documentId = getDocumentId(context);
  openBrowser(config.projectUrl + documentId);
}

function uploadAndOpen(context) {
  log("let's do this");
  showMessage('Alive: Slicing layers...');
  var documentId = getDocumentId(context);
  var rv = _main({
    scale: 2,
    destinationPath: '/project'
  });

  showMessage('Alive: Uploading layers...');
  recursiveUpload(rv.layers, rv.path, documentId);
  var request = createJSONRequest(rv.layers, documentId);
  post(request);

  if (!config.debug) {
    openBrowser(config.projectUrl + documentId);
  }
}

//////// HELPERS ////////

function showMessage(message) {
  NSApplication.sharedApplication().orderedDocuments().firstObject().showMessage(message);
}

function createHash(string) {
  var hash = 0, i, chr, len;
  if (string.length === 0) return hash;
  for (i = 0, len = string.length; i < len; i++) {
    chr   = string.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash);
}

function getDocumentId(context) {
  return createHash(String(context.document.currentPage().objectID()));
}

function getArtboardByName(document, name) {
  var page = document.currentPage();
  return page.artboards().find(function(artboard) {
    return artboard.name() == name;
  });
}

function generateThumbnailForArtboard(document, artboard) {
  var rect = [MSSliceTrimming trimmedRectForSlice: artboard];
  var slice = [MSExportRequest requestWithRect:rect scale:0.5];
  var path = [NSTemporaryDirectory(), artboard.objectID(), '.png'].join('');
  document.saveArtboardOrSlice_toFile_(slice, path);
  return path;
}

function recursiveUpload(layers, imagePath, documentId) {
  var layer;
  var request;
  var path;
  var artboard;
  var document = getActiveDocument(NSApplication.sharedApplication());

  for (var i = 0; i < layers.length; i++) {
    layer = layers[i];
    if (layer.image) {
      path = [imagePath, layer.image.path].join('/');
      request = createFileRequest(path, layer.image.path, documentId);
      post(request);
    }
    if (layer.kind == "artboard") {
      try {
        artboard = getArtboardByName(document, layer.originalName);
        path = generateThumbnailForArtboard(document, artboard);
        request = createFileRequest(path, layer.name, documentId);
        post(request);
      } catch (err) {
        log('recursiveUpload: Error generating thumbnail, ', err)
      }
    }
    recursiveUpload(layer.children, imagePath, documentId);
  }
}

function createJSONRequest(json, documentId) {
  return NSArray.arrayWithObjects(
    "-v", "POST",
    "--header", "Content-Type: multipart/form-data",
    "-F", "documentId=" + documentId,
    "-F", "json=" + JSON.stringify(json),
      config.url,
    nil);
}

function createFileRequest(path, name, documentId) {
  return NSArray.arrayWithObjects(
    "-v", "POST",
    "--header", "Content-Type: multipart/form-data",
    "-F", "documentId=" + documentId,
    "-F", "name=image; filename=" + name + "; Content-Type=image/png;",
    "-F", "image=@" + path,
      config.url,
    nil);
}

function post(args) {
  return run("/usr/bin/curl", args);
}

function openBrowser(url) {
  // [[NSWorkspace sharedWorkspace] openFile:url withApplication:"Safari"];
  run("/usr/bin/open", NSArray.arrayWithObjects("-a", "Safari", url, nil));
}

function run(path, args) {
  var task = NSTask.alloc().init()
  task.setLaunchPath(path);
  if (args) {
    task.setArguments(args);
  }
  // var outputPipe = [NSPipe pipe];
  // [task setStandardOutput:outputPipe];
  task.launch();
  // var outputData = [[outputPipe fileHandleForReading] readDataToEndOfFile];
  // var outputString = [[[NSString alloc] initWithData:outputData encoding:NSUTF8StringEncoding]];
  // if (config.debug == true) {
  //   log(outputString)
  // }
  // return outputString;
}
