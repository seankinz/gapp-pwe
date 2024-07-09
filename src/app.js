import * as css from "./style.css";
import { initializeApp } from 'firebase/app';
import { deleteToken, getMessaging, getToken, onMessage } from 'firebase/messaging';
import { firebaseConfig, vapidKey } from "./config.js";

console.log('app starting');

const CACHE_NAME = 'cache-v0.0.0'
const CACHED_URLS = [
  '/',
  '/manifest.json',
  '/images/logo-192x192.png',
  '/images/logo-512x512.png',
  '/style.css'
]
initializeApp(firebaseConfig);
const messaging = getMessaging();

class App {
  constructor() {
    this.serviceWorker_ = null;

    if ('serviceWorker' in navigator) {
      // console.log('adding service worker');
      // window.addEventListener('load', () => {
      //   navigator.serviceWorker.register('src/cache.js', { scope: './src/' }).then(
      //     serviceWorker => this.cacheWorkerCallback(serviceWorker));
      // });
    }

    // Handle incoming messages. Called when:
    // - a message is received while the app has focus
    // - the user clicks on an app notification created by a service worker
    //   `messaging.onBackgroundMessage` handler.
    onMessage(messaging, (payload) => {
      console.log('Message received. ', payload);
    });

    this.resetUI()
  }

  addEventListeners() {
    // Open cache on install.
    self.addEventListener('install', event => {
      event.waitUntil(async function () {
        const cache = await caches.open(CACHE_NAME)

        await cache.addAll(CACHED_URLS)
      }());
    });

    // Cache and update with stale-while-revalidate policy.
    self.addEventListener('fetch', event => {
      const { request } = event

      if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') {
        return;
      }

      event.respondWith(async function () {
        const cache = await caches.open(CACHE_NAME)

        const cachedResponsePromise = await cache.match(request);
        const networkResponsePromise = fetch(request);

        if (request.url.startsWith(self.location.origin)) {
          event.waitUntil(async function () {
            const networkResponse = await networkResponsePromise;

            await cache.put(request, networkResponse.clone());
          }())
        }

        return cachedResponsePromise || networkResponsePromise;
      }())
    });

    // Clean up caches other than current.
    self.addEventListener('activate', event => {
      event.waitUntil(async function () {
        const cacheNames = await caches.keys()

        await Promise.all(
          cacheNames.filter((cacheName) => {
            const deleteThisCache = cacheName !== CACHE_NAME;

            return deleteThisCache;
          }).map(cacheName => caches.delete(cacheName))
        )
      }());
    });
  }

  cacheWorkerCallback(serviceWorker) {
      this.serviceWorker_ = serviceWorker;
      this.setupNotifications();
  }

  setupNotifications() {
    if (!this.serviceWorker_.showNotification) {
      console.warn('Notifications aren\'t supported.');
      return;
    }
    if (Notification.permission === 'denied') {
      console.warn('The user has blocked notifications.');
      return;
    }
    if (!('PushManager' in window)) {
      console.warn('Push messaging isn\'t supported.');
      return;
    }
    navigator.serviceWorker.ready.then((swReg) => {
      // Do we already have a push message subscription?
      swReg.pushManager.getSubscription()
      .then((subscription) => {
          if(!subscription){
             console.log('No Subscription endpoint present')
          }
      })
   })
  }

  sendTokenToServer(token) {
    console.log('token retreived: ', token);
  }

  resetUI() {
    // Get registration token. Initially this makes a network call, once retrieved
    // subsequent calls to getToken will return from cache.
    getToken(messaging, { vapidKey }).then((currentToken) => {
      if (currentToken) {
        this.sendTokenToServer(currentToken);
        // ready to recieve
      } else {
        // Show permission request.
        console.log('No registration token available. Request permission to generate one.');
        // Show permission UI.
        this.setTokenSentToServer(false);
      }
    }).catch((err) => {
      console.log('An error occurred while retrieving token. ', err);
      this.setTokenSentToServer(false);
    });
  }

  isTokenSentToServer() {
    return window.localStorage.getItem('sentToServer') === '1';
  }
  
  setTokenSentToServer(sent) {
    window.localStorage.setItem('sentToServer', sent ? '1' : '0');
  }

  requestPermission() {
    console.log('Requesting permission...');
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        console.log('Notification permission granted.');
        // TODO(developer): Retrieve a registration token for use with FCM.
        // In many cases once an app has been granted notification permission,
        // it should update its UI reflecting this.
        this.resetUI();
      } else {
        console.log('Unable to get permission to notify.');
      }
    });
  }

  deleteTokenFromFirebase() {
    // Delete registration token.
    getToken(messaging).then((currentToken) => {
      deleteToken(messaging).then(() => {
        console.log('Token deleted.', currentToken);
        setTokenSentToServer(false);
        // Once token is deleted update UI.
        resetUI();
      }).catch((err) => {
        console.log('Unable to delete token. ', err);
      });
    }).catch((err) => {
      console.log('Error retrieving registration token. ', err);
      showToken('Error retrieving registration token.');
    });
  }
}

const app = new App();
app.addEventListeners();
