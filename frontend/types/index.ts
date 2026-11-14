import type { Polygon } from 'geojson';
export interface FarmField { id:string; farmId:string; name:string; locationName:string; geometry:Polygon; centroid:[number,number]; areaHectares:number; currentCrop:string; previousCrop:string; soilType:string; irrigationType:string; notes:string; createdAt:string; updatedAt:string }
export interface Farm { id:string; name:string; locationName:string; createdAt:string; updatedAt:string; fields:string[] }
export interface ClimateObservation { coordinates:[number,number]; source:string; observationPeriod:string; spatialResolution:string; temperature:number[]; precipitation:number[]; solarRadiation:number[]; status:'demo'|'live'|'error' }
export interface RotationScenario { id:string; fieldId:string; title:string; farmerPriority:string[]; cropSequence:string[]; benefits:string[]; tradeoffs:string[]; assumptions:string[]; dataSource:string; isIllustrative:boolean }
