let map;
let jsonCalls;
let jsonERBs;
let originAzimuth;
let destinyAzimuth;
let azimuthList = [];

const RADIUS = 1200;

$(function() {
    $('#modalInicio').modal('show');

    $('#formArquivo').on("submit", function (e) {
        readExcelFile();
        e.preventDefault();
    });
});

function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
      zoom: 13,
      center: { lat: -23.555, lng: -46.638 }
    });
}

function readExcelFile(){
    var fileInput = document.getElementById('excel-file');
    var file = fileInput.files[0];
    var reader = new FileReader();

    reader.onload = function (e) {
        var data = new Uint8Array(e.target.result);
        var workbook = XLSX.read(data, { type: 'array' });
        var aba1 = workbook.Sheets[workbook.SheetNames[0]];
        var aba2 = workbook.Sheets[workbook.SheetNames[2]];
        var descText = XLSX.utils.sheet_to_json(aba1, {range: "B4:B4", header: 1})[0][0];
        jsonCalls = XLSX.utils.sheet_to_json(aba1, { range: 5 });
        jsonERBs = XLSX.utils.sheet_to_json(aba2, { range: 5 });
        
        descText = descText.replace(/    /g, "<br/>");
        descText = descText.replace(/:/g, ": ");

        $('#modalInicio').modal('hide');
        $('nav').removeClass("d-none");

        processJsonERBs();
        processJsonCalls();

        var mascaraTel = function (val) {
            return val.replace(/\D/g, '').length === 11 ? '(00) 00000-0000' : '(00) 0000-00009';
        };

        $('.textTel1').mask(mascaraTel);
        $('.textTel2').mask(mascaraTel);
        $("#itemLigacao").addClass("d-none");
        $("#textDescricao").html(descText);
        $("#textQtdRegistros").text(jsonCalls.length);

        var firstCall = jsonCalls[0];
        if(firstCall["Local Origem"].trim()) {
            setMapPosition(firstCall["Local Origem"]);
        } else if(firstCall["Local Destino"].trim()) {
            setMapPosition(firstCall["Local Destino"]);
        }
    }
    reader.readAsArrayBuffer(file);
}

function processJsonERBs() {
    for (var i = 0; i < jsonERBs.length; i++) {
        var erb = jsonERBs[i];
        var latitude = erb.Latitude;
        var latitudeParts = latitude.split("-");
        var latitudeDegrees = latitudeParts[1]?latitudeParts[1].replace(/,/g, '.'):0;
        var latitudeMinutes = latitudeParts[2]?latitudeParts[2].replace(/,/g, '.'):0;
        var latitudeSeconds = latitudeParts[3]?latitudeParts[3].replace(/,/g, '.'):0;
        var latitudeDirection = latitude.charAt(0);
        var latitudeConvertido = ConvertDMSToDD(latitudeDegrees, latitudeMinutes, latitudeSeconds, latitudeDirection);
        var longitude = erb.Longitude;
        var longitudeParts = longitude.split("-");
        var longitudeDegrees = longitudeParts[1]?longitudeParts[1].replace(/,/g, '.'):0;
        var longitudeMinutes = longitudeParts[2]?longitudeParts[2].replace(/,/g, '.'):0;
        var longitudeSeconds = longitudeParts[3]?longitudeParts[3].replace(/,/g, '.'):0;
        var longitudeDirection = longitude.charAt(0);
        var longitudeConvertido = ConvertDMSToDD(longitudeDegrees, longitudeMinutes, longitudeSeconds, longitudeDirection);
        erb.Latitude = latitudeConvertido;
        erb.Longitude = longitudeConvertido;
        erb.Azi = parseFloat(erb.Azi );
    }
}

function processJsonCalls(){
    for (var i = 0; i < jsonCalls.length; i++) {
        var ligacao = jsonCalls[i];

        var itemClone = $("#itemLigacao").clone();
        itemClone.attr("id", "itemLigacao" + i);
        itemClone.attr("index", i);
        
        itemClone.find(".textIndex").each(function () {
            $(this).text(i+1);
        });

        itemClone.find(".textDuracao").each(function () {
            $(this).text(ligacao.Durac + "s");
        });
        itemClone.find(".textDataHora").each(function () {
            $(this).text(ligacao.Data + " " + ligacao.Hora);
        });
        itemClone.find(".textTel1").each(function () {
            $(this).text(ligacao.Chamador);
        });        
        itemClone.find(".textTel2").each(function () {
            $(this).text(ligacao.Chamado);
        });

        if(ligacao["IMEI Chamador"]) {
            itemClone.find(".textIMEI1 span").each(function () {               
                $(this).text(ligacao["IMEI Chamador"]);
            });
        } else {
            itemClone.find(".textIMEI1 span").each(function () {               
                $(this).text("Desconhecido");
            });
        }

         if(ligacao["IMEI Chamado"]) {
            itemClone.find(".textIMEI2 span").each(function () {               
                $(this).text(ligacao["IMEI Chamado"]);
            });
        } else {
            itemClone.find(".textIMEI2 span").each(function () {               
                $(this).text("Desconhecido");
            });
        }

        if(ligacao.Status != "Completada") {
            itemClone.find(".iconType").each(function () {               
                $(this).removeClass("bi-telephone-forward");
                $(this).addClass("bi-telephone-x");
                $(this).attr("title", "Chamada Não Completada");
            });
        }

        var drawAzimuthOrigin = printAzimuth(ligacao["Local Origem"], false);
        var drawAzimuthDestitny = printAzimuth(ligacao["Local Destino"], true);
        azimuthList.push({origin: drawAzimuthOrigin, destiny: drawAzimuthDestitny});

        if(drawAzimuthOrigin) {
            itemClone.find(".textIMEI1").each(function () {     
                $(this).removeClass("text-bg-secondary");          
                $(this).addClass("text-bg-success");
            });
            itemClone.find(".check1").each(function () {               
                $(this).prop("disabled", false);
                $(this).prop("checked", true);
            });
        }
        if(drawAzimuthDestitny) {
            itemClone.find(".textIMEI2").each(function () {     
                $(this).removeClass("text-bg-secondary");          
                $(this).addClass("text-bg-danger");
            });
            itemClone.find(".check2").each(function () {               
                $(this).prop("disabled", false);
                $(this).prop("checked", true);
            });
        }

        itemClone.appendTo("#listaLigacoes");   
    }
}

function ConvertDMSToDD(degrees, minutes, seconds, direction) {
    var dd = parseFloat(degrees) + parseFloat(minutes)/60 + parseFloat(seconds)/(60*60);
    if (direction == "-") {
        dd = dd * -1;
    }
    return dd;
}

function setMapPosition(erbCode) {
    if(erbCode) {
        var result = jsonERBs.filter(obj => {
            return obj.CGI === erbCode
        });

        if(result && result[0]) {
            var erb = result[0];
            map.setCenter(new google.maps.LatLng(erb.Latitude, erb.Longitude));
        }
    }    
}

function printAzimuth(erbCode, isDestiny) {
    if(erbCode) {
        var result = jsonERBs.filter(obj => {
            return obj.CGI === erbCode
        });

        if(result && result[0]) {
            var erb = result[0];
            var latitude = erb.Latitude;
            var longitude = erb.Longitude;
            var angle = 90;
            var opening = erb.Azi;
            var color = "#198754";    

            if(isDestiny) {
                color = "#DC3545";
            }

            var center = { lat: latitude, lng: longitude };
            var startAngle = opening - angle / 2;
            var endAngle = opening + angle / 2;

            var path = [];
            path.push(center);

            for (var j = startAngle; j <= endAngle; j += 5) {
                var point = google.maps.geometry.spherical.computeOffset(center, RADIUS, j);
                path.push(point);
            }

            var slice = new google.maps.Polygon({
                paths: path,
                strokeColor: color,
                strokeOpacity: .5,
                strokeWeight: 2,
                fillColor: color,
                fillOpacity: 0.25,
                map: map
            });
        }        
    }

    return slice;
}

function checkboxAction(obj, isDestiny){
    var index = $(obj).closest('.list-group-item').attr('index');

    if(isDestiny) {
        var azimuthDraw = azimuthList[index].destiny;
        var erbCode = jsonCalls[index]["Local Destino"];
    } else {
        var azimuthDraw = azimuthList[index].origin;
        var erbCode = jsonCalls[index]["Local Origem"];
    }

    if(obj.checked && azimuthDraw){
        azimuthDraw.setMap(map);
        $(obj).prop("checked", true);
        setMapPosition(erbCode);
    } else {
        azimuthDraw.setMap(null);
        $(obj).prop("checked", false);
    }

}

function toggleAllCheckbox(isCheck, isDestiny) {
    for (var i = 0; i < azimuthList.length; i++) {
        if(isDestiny) {
            var azimuth = azimuthList[i].destiny;
            var check =  $(".check2", "#itemLigacao"+i);
        } else {
            var azimuth = azimuthList[i].origin;
            var check =  $(".check1", "#itemLigacao"+i);
        }

        if(azimuth) {
            if(isCheck) {
                azimuth.setMap(map);
                check.prop("checked", true);
            } else {
                azimuth.setMap(null);
                check.prop("checked", false);
            }
        }    
    }
}