declare module 'shapefile' {
  import type { Feature } from 'geojson';

  interface ShapefileSource {
    read(): Promise<{ done: boolean; value?: Feature }>;
  }

  function open(shpPath: string, dbfPath?: string): Promise<ShapefileSource>;

  export { open };
  export default { open };
}
