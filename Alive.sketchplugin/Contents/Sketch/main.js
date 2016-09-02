
function yell(msg) {
  NSApplication.sharedApplication().orderedDocuments().firstObject().showMessage(msg);
}

function helloworld(context) {
  alex_uploadLayers(context);
}

function alex_uploadLayers(context) {
  log('alex_uploadLayers')
  var count = 0;
  var document = context.document;
  var project = getProjectName(document);
  var selection = context.selection;
  var loop = selection.objectEnumerator();

  // loop over all selected objects
  while ((item = loop.nextObject()) !== null) {
    if (item.className() != "MSArtboardGroup") {
      continue;
    }
    count++;
    var layers = alex_encodeLayer(item, document);
    var payload = {
      layers: layers,
      width: Number(item.rect().size.width),
      height: Number(item.rect().size.height),
      objectID: String(item.objectID())
    }
    // HTTP POST it
    alex_postFile(null, item.name(), project, payload);
  }
  document.showMessage("uploaded by " + config.email + ' to ' + config.url + '.');
}

function alex_encodeLayer(layer, document) {
  // upload png slice
  var path = NSTemporaryDirectory() + String(layer.objectID()) + ".png";
  log(path, layer)
  var rect = [MSSliceTrimming trimmedRectForSlice:layer]; // layer
  var slice = [MSExportRequest requestWithRect:rect scale:2];
  [document saveArtboardOrSlice:slice toFile: path];
  alex_postFile(path, layer.name(), "", {});

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
    rv.l.push(alex_encodeLayer(child, document));
  }
  return rv;
}

function alex_postFile(path, name, project, payload) {

  var dataImg = [[NSFileManager defaultManager] contentsAtPath:path];
  var postLength = [dataImg length].toString()

  var task = NSTask.alloc().init()
  task.setLaunchPath("/usr/bin/curl");
    // "--proxy", "localhost:8888",

  var args = NSArray.arrayWithObjects(
    "-v",
    "POST",
    "--header", "Content-Type: multipart/form-data",
    "--header", "User-Agent: IteratorPlugin",
    "-F", "key=" + config.key,
    "-F", "email=" + config.email,
    "-F", "project=" + project,
    "-F", "payload=" + JSON.stringify(payload),
    "-F", "name=image; filename=" + name + "; Content-Type=image/png;",
    "-F", "image=@" + path,
      config.url + '/upload',
    nil);

  task.setArguments(args);

  var outputPipe = [NSPipe pipe];
  [task setStandardOutput:outputPipe];
  task.launch();
  var outputData = [[outputPipe fileHandleForReading] readDataToEndOfFile];
  var outputString = [[[NSString alloc] initWithData:outputData encoding:NSUTF8StringEncoding]];
  if (DEBUG == true) {
    log(outputString)
  }
}
