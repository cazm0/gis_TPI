// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock OpenLayers
jest.mock('ol/Map', () => {
  return jest.fn().mockImplementation(() => ({
    getView: jest.fn(() => ({
      getResolution: jest.fn(() => 1000),
      getProjection: jest.fn(() => ({
        getUnits: jest.fn(() => 'm')
      })),
      on: jest.fn(),
      un: jest.fn(),
      animate: jest.fn(),
      getZoom: jest.fn(() => 5),
      calculateExtent: jest.fn(() => [-100, -100, 100, 100])
    })),
    getSize: jest.fn(() => [800, 600]),
    on: jest.fn(),
    un: jest.fn(),
    addLayer: jest.fn(),
    removeLayer: jest.fn(),
    addInteraction: jest.fn(),
    removeInteraction: jest.fn(),
    setTarget: jest.fn(),
    getTargetElement: jest.fn()
  }));
});

jest.mock('ol/View', () => {
  return jest.fn().mockImplementation(() => ({
    getResolution: jest.fn(() => 1000),
    getProjection: jest.fn(() => ({
      getUnits: jest.fn(() => 'm')
    })),
    on: jest.fn(),
    un: jest.fn(),
    animate: jest.fn(),
    getZoom: jest.fn(() => 5),
    calculateExtent: jest.fn(() => [-100, -100, 100, 100])
  }));
});

jest.mock('ol/proj', () => ({
  fromLonLat: jest.fn((coords) => coords),
  toLonLat: jest.fn((coords) => coords)
}));

jest.mock('ol/control', () => ({
  defaults: jest.fn(() => [])
}));

jest.mock('ol/layer/Tile', () => {
  return jest.fn().mockImplementation(() => ({}));
});

jest.mock('ol/source/OSM', () => {
  return jest.fn().mockImplementation(() => ({}));
});

jest.mock('ol/layer/Image', () => {
  return jest.fn().mockImplementation(() => ({
    getSource: jest.fn(() => ({
      getParams: jest.fn(() => ({ LAYERS: 'test' })),
      getFeatureInfoUrl: jest.fn(() => 'http://test.com')
    })),
    setVisible: jest.fn(),
    getVisible: jest.fn(() => false)
  }));
});

jest.mock('ol/source/ImageWMS', () => {
  return jest.fn().mockImplementation(() => ({
    getParams: jest.fn(() => ({ LAYERS: 'test' })),
    getFeatureInfoUrl: jest.fn(() => 'http://test.com')
  }));
});