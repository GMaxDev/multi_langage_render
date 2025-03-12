function createRenderPanel(thisObj) {
    var panel = (thisObj instanceof Panel) ? thisObj : new Window("palette", "Rendu Multilingue", undefined, { resizeable: true });

    if (panel) {
        panel.text = "Rendu Multilingue";

        // Groupe principal qui prend toute la place
        var mainGroup = panel.add("group");
        mainGroup.orientation = "column";
        mainGroup.alignment = ["fill", "fill"];

        // Conteneur flexible pour pousser le bouton au centre (vertical)
        var spacerTop = mainGroup.add("group");
        spacerTop.alignment = ["fill", "fill"];
        spacerTop.add("statictext", undefined, "");

        // Groupe qui occupe toute la largeur pour centrer horizontalement
        var centerGroup = mainGroup.add("group");
        centerGroup.alignment = ["fill", "center"]; // Remplit horizontalement, centre verticalement
        centerGroup.alignChildren = ["center", "center"]; // Centre les éléments à l’intérieur

        // Bouton centré
        var btnRender = centerGroup.add("button", undefined, "Lancer le rendu");

        // Conteneur flexible en bas pour équilibrer l'espace (vertical)
        var spacerBottom = mainGroup.add("group");
        spacerBottom.alignment = ["fill", "fill"];
        spacerBottom.add("statictext", undefined, "");

        btnRender.onClick = function () {
            (function renderAllLanguagesSequentially() {
                app.beginUndoGroup("Render All Languages");

                var project = app.project;
                if (!project) {
                    alert("❌ Aucun projet ouvert !");
                    return;
                }

                var jsonFile = null;
                for (var i = 1; i <= project.numItems; i++) {
                    if (project.item(i) instanceof FootageItem && project.item(i).name === "traductions.json") {
                        jsonFile = project.item(i);
                        break;
                    }
                }

                if (!jsonFile) {
                    alert("❌ Fichier 'traductions.json' introuvable !");
                    return;
                }

                var jsonData;
                var file = new File(jsonFile.file.fsName);

                if (file.exists) {
                    file.open("r");
                    var rawText = file.read();
                    file.close();

                    try {
                        eval("jsonData = " + rawText);
                    } catch (e) {
                        alert("❌ Erreur de parsing JSON : " + e.message);
                        return;
                    }
                } else {
                    alert("❌ Impossible d'ouvrir le fichier JSON !");
                    return;
                }

                var selectedComps = [];
                for (var i = 1; i <= project.numItems; i++) {
                    if (project.item(i) instanceof CompItem && project.item(i).selected) {
                        selectedComps.push(project.item(i));
                    }
                }

                if (selectedComps.length === 0) {
                    alert("❌ Sélectionne au moins une composition !");
                    return;
                }

                var destFolder = Folder.selectDialog("Sélectionne le dossier de destination");
                if (!destFolder) {
                    alert("❌ Aucun dossier sélectionné.");
                    return;
                }

                function getKeys(obj) {
                    var keys = [];
                    for (var key in obj) {
                        if (obj.hasOwnProperty(key)) {
                            keys.push(key);
                        }
                    }
                    return keys;
                }

                var languesDispos = getKeys(jsonData);

                // Crée les dossiers pour chaque langue
                for (var i = 0; i < languesDispos.length; i++) {
                    var langue = languesDispos[i];
                    var langueFolder = new Folder(destFolder.fsName + "/" + langue);
                    if (!langueFolder.exists) {
                        langueFolder.create();
                    }
                }

                function renderNextLanguage(comp, index, compIndex) {
                    if (index >= languesDispos.length) {
                        if (compIndex < selectedComps.length - 1) {
                            renderNextLanguage(selectedComps[compIndex + 1], 0, compIndex + 1);
                        } else {
                            alert("✅ Tous les rendus sont terminés !");
                        }
                        return;
                    }

                    var langue = languesDispos[index];
                    // Active/Désactive les calques selon la langue
                    setLayerVisibilityRecursive(comp, langue);

                    function setLayerVisibilityRecursive(comp, langue) {
                        for (var i = 1; i <= comp.numLayers; i++) {
                            var layer = comp.layer(i);
                            var layerName = layer.name;
                    
                            // Si c'est une précomposition, on applique la fonction récursivement
                            if (layer.source && layer.source instanceof CompItem) {
                                setLayerVisibilityRecursive(layer.source, langue);
                            }
                    
                            // Vérifie si le calque a un préfixe correspondant à une langue
                            var prefixMatch = layerName.match(/^([A-Z]{2})_/);
                            if (prefixMatch) {
                                var layerLang = prefixMatch[1]; // Récupère le préfixe de la langue (ex: "FR", "DE")
                    
                                if (layerLang === langue) {
                                    layer.enabled = true;  // Active les calques de la langue en cours
                                } else {
                                    layer.enabled = false; // Désactive les autres langues
                                }
                            }
                        }
                    }

                    var sliderLayer = comp.layer("choix_langue");
                    if (!sliderLayer) {
                        alert("❌ Calque 'choix_langue' introuvable !");
                        return;
                    }

                    var slider = sliderLayer.effect("Langue")("Curseur");
                    if (!slider) {
                        alert("❌ Effet 'Langue' introuvable !");
                        return;
                    }

                    slider.setValue(index);

                    var renderQueue = project.renderQueue;
                    var renderItem = renderQueue.items.add(comp);

                    var fileName = comp.name + " - " + langue + ".mp4";
                    var filePath = destFolder.fsName + "/" + langue + "/" + fileName;

                    var outputModule = renderItem.outputModule(1);
                    outputModule.file = new File(filePath);

                    app.project.renderQueue.render();
                    while (app.project.renderQueue.rendering) {
                        $.sleep(500);
                    }

                    renderNextLanguage(comp, index + 1, compIndex);
                }

                renderNextLanguage(selectedComps[0], 0, 0);

                app.endUndoGroup();
            })();
        };

        if (panel instanceof Window) {
            panel.center();
            panel.show();
        } else {
            panel.layout.layout(true);
        }
    }
}

// Exécuter le script
createRenderPanel(this);
