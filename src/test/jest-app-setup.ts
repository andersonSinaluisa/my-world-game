/**
 * Setup of the `app` Jest project: Reanimated and Worklets run on the UI thread in the app; in Jest
 * their official mocks run animations synchronously (HU-GAME-002).
 */
/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must use require */
jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
