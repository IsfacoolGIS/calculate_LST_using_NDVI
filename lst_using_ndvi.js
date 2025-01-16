var ghy = roi;

//>>> These are the scaling factors which are applied
function applyScaleFactors(image) {
var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2);
var thermalBands = image.select('ST_B.*').multiply(0.00341802).add(149.0);
return image.addBands(opticalBands, null, true)
          .addBands(thermalBands, null, true);
}

//----->>cloud mask the imagery
function maskL8sr(col) {
var cloudShadowBitMask = (1 << 3);
var cloudsBitMask = (1 << 5);
var qa = col.select('QA_PIXEL');
//--->> setting it zero so that  clear condition is ensured
var mask = qa.bitwiseAnd(cloudShadowBitMask).eq(0)
             .and(qa.bitwiseAnd(cloudsBitMask).eq(0));
return col.updateMask(mask);
}

//----->> Ensure filtering the collection with roi and desired date range
var image = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
.filterDate('2024-01-01', '2024-12-31')
.filterBounds(ghy)
.map(applyScaleFactors)
.map(maskL8sr)
.median();

var visParams = {
bands: ['SR_B4', 'SR_B3', 'SR_B2'],
min: 0.0,
max: 0.3,
};

Map.addLayer(image.clip(ghy), visParams, 'tcc', false);

//----> Calculate ndvi
var ndvi  = image.normalizedDifference(['SR_B5', 'SR_B4']).rename('NDVI')
Map.addLayer(ndvi.clip(ghy), {min:-1, max:1, palette: ['blue', 'white', 'green']}, 'NDVI', false)

//----> ndvi statistics
var ndvi_min = ee.Number(ndvi.reduceRegion({
reducer: ee.Reducer.min(),
geometry: ghy,
scale: 30,
maxPixels: 1e9
}).values().get(0))

var ndvi_max = ee.Number(ndvi.reduceRegion({
reducer: ee.Reducer.max(),
geometry: ghy,
scale: 30,
maxPixels: 1e9
}).values().get(0))


//----> fraction of veg to emphasize the area with higher vegetation
var fv = (ndvi.subtract(ndvi_min).divide(ndvi_max.subtract(ndvi_min))).pow(ee.Number(2))
      .rename('FV')


var em = fv.multiply(ee.Number(0.004)).add(ee.Number(0.986)).rename('EM')

var thermal = image.select('ST_B10').rename('thermal')

var lst = thermal.expression(
    '(tb / (1 + ((11.5 * (tb / 14380)) * log(em)))) - 273.15',
    {
        'tb': thermal.select('thermal'), 
        'em': em                        
    }
).rename('LST');

var lst_vis = {
  min: 7,
  max: 50,
  palette: [
    '0000ff', '0033cc', '0066cc', '3399cc', '66cccc', '99ccff', 
    'c1e0ff', 'c1f2ff', 'b3f0e0', '99e6b3', '80d880', '66cc66', 
    '4db34d', '33a833', '1fa21f', '00b300', '33cc00', '66cc33',
    '99cc66', 'b3cc66', 'ffcc33', 'ff9900', 'cc6600', 'b35800', 
    'f2c100'
  ]
};


Map.addLayer(lst.clip(ghy), lst_vis, 'LST')
Map.centerObject(ghy, 10)
