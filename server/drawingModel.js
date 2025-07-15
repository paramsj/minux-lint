const mongoose = require('mongoose');

const segmentSchema = new mongoose.Schema({
  x1: Number,
  y1: Number,
  x2: Number,
  y2: Number,
  color: String
});

const strokeSchema = new mongoose.Schema({
  segments: [segmentSchema],
  clientId: String
});

const drawingSchema = new mongoose.Schema({
  strokes: [strokeSchema]
});

module.exports = mongoose.model('Drawing', drawingSchema);