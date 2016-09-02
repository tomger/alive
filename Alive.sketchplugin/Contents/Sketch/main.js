var config = {
  url: 'http://127.0.0.1/upload',
  debug: true
};

function yell(msg) {
  NSApplication.sharedApplication().orderedDocuments().firstObject().showMessage(msg);
}

function upload(context) {
  log('uploadLayers')
  var document = context.document;
  var selection = context.selection;
  var loop = selection.objectEnumerator();

  // loop over all selected objects and only handle Artboards
  while ((item = loop.nextObject()) !== null) {
    if (item.className() != "MSArtboardGroup") {
      continue;
    }
    var session = String(Date.now()) + String(Math.round(Math.random() * 1000));
    uploadArtboard(item, session, document);
  }
}

function uploadArtboard(artboard, session, document) {
  var layers = uploadLayer(artboard, session, document);
  var artboardMetaInfo = {
    layers: layers,
    width: Number(artboard.rect().size.width),
    height: Number(artboard.rect().size.height),
    objectID: String(artboard.objectID())
  }
  post(createJSONRequest(artboardMetaInfo, session));
  document.showMessage('Uploaded artboard to ' + config.url + '.');
}

function uploadLayer(layer, session, document) {
  log('uploadLayer')

  // upload png slice
  var path = NSTemporaryDirectory() + String(layer.objectID()) + ".png";
  var rect = [MSSliceTrimming trimmedRectForSlice:layer]; // layer
  var slice = [MSExportRequest requestWithRect:rect scale:2];
  [document saveArtboardOrSlice:slice toFile: path];
  post(createFileRequest(path, layer.name(), session));

  // add the png to the tree
  var rv = {
    o: String(layer.objectID()),
    x: Number(layer.rect().origin.x),
    y: Number(layer.rect().origin.y),
    w: Number(layer.rect().size.width),
    h: Number(layer.rect().size.height)
  }
  for (var i = 0; layer.layers && i < layer.layers().count(); i++) {
    if (!rv.l) {
      rv.l = [];
    }
    var child = layer.layers().objectAtIndex(i);
    rv.l.push(uploadLayer(child, session, document));
  }
  return rv;
}

function createJSONRequest(json, session) {
  return NSArray.arrayWithObjects(
    "-v", "POST",
    "--header", "Content-Type: multipart/form-data",
    "-F", "session=" + session,
    "-F", "payload=" + JSON.stringify(json),
      config.url + '/upload',
    nil);
}

function createFileRequest(path, name, session) {
  return NSArray.arrayWithObjects(
    "-v", "POST",
    "--header", "Content-Type: multipart/form-data",
    "-F", "session=" + session,
    "-F", "name=image; filename=" + name + "; Content-Type=image/png;",
    "-F", "image=@" + path,
      config.url + '/upload',
    nil);
}

function post(args) {
  log('post')
  var task = NSTask.alloc().init()
  task.setLaunchPath("/usr/bin/curl");
  task.setArguments(args);
  var outputPipe = [NSPipe pipe];
  [task setStandardOutput:outputPipe];
  task.launch();
  var outputData = [[outputPipe fileHandleForReading] readDataToEndOfFile];
  var outputString = [[[NSString alloc] initWithData:outputData encoding:NSUTF8StringEncoding]];
  if (config.debug == true) {
    log(outputString)
  }
  return outputString;
}
