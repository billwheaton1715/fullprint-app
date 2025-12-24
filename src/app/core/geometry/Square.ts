import Rectangle from './Rectangle';
import Point from './Point';
import Measurement from '../units/Measurement';

export class Square extends Rectangle {
  constructor(topLeft: Point, size: Measurement) {
    super(topLeft, size, size);
  }
}

export default Square;
