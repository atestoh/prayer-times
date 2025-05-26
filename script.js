document.addEventListener('DOMContentLoaded', () => {
    const locationDisplay = document.querySelector('.location-display');
    const dateDisplay = document.querySelector('.date-display');
    const fajrTime = document.getElementById('fajr-time');
    const sunriseTime = document.getElementById('sunrise-time');
    const dhuhrTime = document.getElementById('dhuhr-time');
    const asrTime = document.getElementById('asr-time');
    const maghribTime = document.getElementById('maghrib-time');
    const ishaTime = document.getElementById('isha-time');
    const refreshButton = document.getElementById('refresh-button');
    const lastUpdatedDisplay = document.querySelector('.last-updated');

    // Aladhan API for monthly prayer times
    const PRAYER_API_URL = 'https://api.aladhan.com/v1/calendar';
    const CACHE_KEY = 'monthlyPrayerTimesCache'; // Key for localStorage

    // Helper to format time
    function formatTime(time24hr) {
        if (!time24hr) return '--:--';
        const [hours, minutes] = time24hr.split(':');
        const h = parseInt(hours, 10);
        const m = parseInt(minutes, 10);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const formattedH = h % 12 === 0 ? 12 : h % 12;
        return `${formattedH}:${m.toString().padStart(2, '0')} ${ampm}`;
    }

    // Function to display prayer times for a given day
    function displayPrayerTimes(timings, date, isCached = false) {
        fajrTime.textContent = formatTime(timings.Fajr);
        sunriseTime.textContent = formatTime(timings.Sunrise);
        dhuhrTime.textContent = formatTime(timings.Dhuhr);
        asrTime.textContent = formatTime(timings.Asr);
        maghribTime.textContent = formatTime(timings.Maghrib);
        ishaTime.textContent = formatTime(timings.Isha);

        // Display the date for which the times are shown
        const displayDate = new Date(date);
        dateDisplay.textContent = displayDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        if (isCached) {
            lastUpdatedDisplay.textContent = `(from cache, last fetched: ${new Date(timings.fetchedAt).toLocaleDateString()} ${new Date(timings.fetchedAt).toLocaleTimeString()})`;
        } else {
            lastUpdatedDisplay.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
        }
    }

    // Function to display errors
    function displayError(message) {
        const existingError = document.querySelector('.error-message');
        if (existingError) existingError.remove(); // Remove previous error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.backgroundColor = '#f8d7da';
        errorDiv.style.color = '#721c24';
        errorDiv.style.border = '1px solid #f5c6cb';
        errorDiv.style.padding = '10px';
        errorDiv.style.borderRadius = '5px';
        errorDiv.style.marginBottom = '20px';
        errorDiv.textContent = message;
        document.querySelector('.container').prepend(errorDiv);
        setTimeout(() => errorDiv.remove(), 7000); // Remove after 7 seconds
    }

    // Function to save data to localStorage
    function savePrayerTimesToCache(data) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(data));
            console.log('Prayer times saved to cache.');
        } catch (e) {
            console.error('Error saving to localStorage:', e);
            displayError('Could not save prayer times for offline use. Storage might be full.');
        }
    }

    // Function to load data from localStorage
    function loadPrayerTimesFromCache() {
        try {
            const cachedData = localStorage.getItem(CACHE_KEY);
            return cachedData ? JSON.parse(cachedData) : null;
        } catch (e) {
            console.error('Error loading from localStorage:', e);
            return null;
        }
    }

    // Function to fetch monthly prayer times from API
    async function fetchMonthlyPrayerTimes(latitude, longitude, month, year, initialLoad = false) {
        locationDisplay.textContent = `Location: Lat ${latitude.toFixed(2)}, Lon ${longitude.toFixed(2)}`;
        lastUpdatedDisplay.textContent = initialLoad ? 'Fetching latest times...' : 'Refreshing times...';

        const url = `${PRAYER_API_URL}?latitude=${latitude}&longitude=${longitude}&method=2&month=${month}&year=${year}`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log('API Data:', data);

            if (data.data) {
                const today = new Date();
                const todayDay = today.getDate(); // 1-31
                const todayMonth = today.getMonth() + 1; // 1-12
                const todayYear = today.getFullYear();

                // Store all monthly data + metadata
                const cacheData = {
                    timings: data.data,
                    latitude: latitude,
                    longitude: longitude,
                    month: month,
                    year: year,
                    fetchedAt: new Date().toISOString() // When this data was actually fetched
                };
                savePrayerTimesToCache(cacheData);

                // Find today's timings within the fetched monthly data
                const todaysTimings = data.data.find(dayData => {
                    const apiDate = new Date(dayData.date.readable);
                    return apiDate.getDate() === todayDay &&
                           (apiDate.getMonth() + 1) === todayMonth &&
                           apiDate.getFullYear() === todayYear;
                });

                if (todaysTimings && todaysTimings.timings) {
                    displayPrayerTimes(todaysTimings.timings, todaysTimings.date.readable);
                } else {
                    displayError('No prayer times found for today in the fetched data.');
                }
            } else {
                displayError('No prayer times data received from API.');
            }
        } catch (error) {
            console.error('Error fetching prayer times:', error);
            displayError('Could not fetch new prayer times. Using cached data if available, or check internet.');
            // Try to load from cache if fetch failed
            const cached = loadPrayerTimesFromCache();
            if (cached) {
                const today = new Date();
                const todayDay = today.getDate();
                const todayMonth = today.getMonth() + 1;
                const todayYear = today.getFullYear();

                if (cached.month === todayMonth && cached.year === todayYear) {
                    const todaysTimings = cached.timings.find(dayData => {
                        const apiDate = new Date(dayData.date.readable);
                        return apiDate.getDate() === todayDay;
                    });
                    if (todaysTimings) {
                        displayPrayerTimes(todaysTimings.timings, todaysTimings.date.readable, true);
                        locationDisplay.textContent = `Location: Lat ${cached.latitude.toFixed(2)}, Lon ${cached.longitude.toFixed(2)}`;
                    } else {
                        displayError('Cached data available, but no times for today found.');
                    }
                } else {
                    displayError('Cached data is for a different month/year and new fetch failed.');
                }
            }
        }
    }

    // Main function to get user's location and manage data
    function initPrayerTimes(forceRefresh = false) {
        const today = new Date();
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();

        const cachedData = loadPrayerTimesFromCache();

        // Try to use cached data first if not forcing refresh
        if (cachedData && !forceRefresh) {
            const cacheDate = new Date(cachedData.fetchedAt);
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(today.getDate() - 7); // Data is considered 'old' after 7 days
            
            // Check if cached data is for the current month/year and not too old
            if (cachedData.month === currentMonth && 
                cachedData.year === currentYear && 
                cacheDate > oneWeekAgo) 
            {
                console.log('Using cached data...');
                const todayDay = today.getDate();
                const todaysTimings = cachedData.timings.find(dayData => {
                    const apiDate = new Date(dayData.date.readable);
                    return apiDate.getDate() === todayDay;
                });

                if (todaysTimings && todaysTimings.timings) {
                    displayPrayerTimes(todaysTimings.timings, todaysTimings.date.readable, true);
                    locationDisplay.textContent = `Location: Lat ${cachedData.latitude.toFixed(2)}, Lon ${cachedData.longitude.toFixed(2)}`;
                    lastUpdatedDisplay.textContent = `(from cache, last fetched: ${new Date(cachedData.fetchedAt).toLocaleDateString()} ${new Date(cachedData.fetchedAt).toLocaleTimeString()})`;
                    return; // Displayed from cache, no need to fetch unless forced
                } else {
                    console.log('Cached data for current month/year but no times for today, fetching new.');
                }
            } else {
                console.log('Cached data is old or for different month/year, fetching new.');
            }
        }

        // If no cached data, or cache is old/irrelevant, or forcing refresh, get location to fetch new data
        if (navigator.geolocation) {
            locationDisplay.textContent = 'Getting your location...';
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    await fetchMonthlyPrayerTimes(lat, lon, currentMonth, currentYear, true);
                },
                (error) => {
                    console.error('Geolocation error:', error);
                    let errorMessage = 'Could not get your location.';
                    if (error.code === error.PERMISSION_DENIED) {
                        errorMessage += ' Please enable location services and grant permission to this site.';
                    } else if (error.code === error.POSITION_UNAVAILABLE) {
                        errorMessage += ' Location information is unavailable.';
                    } else if (error.code === error.TIMEOUT) {
                        errorMessage += ' The request to get user location timed out.';
                    }
                    displayError(errorMessage + ' Displaying cached data if available.');
                    locationDisplay.textContent = 'Location unavailable.';

                    // If location fails, try to load from cache
                    const cached = loadPrayerTimesFromCache();
                    if (cached) {
                        const todayDay = today.getDate();
                        const todaysTimings = cached.timings.find(dayData => {
                            const apiDate = new Date(dayData.date.readable);
                            return apiDate.getDate() === todayDay;
                        });
                        if (todaysTimings) {
                            displayPrayerTimes(todaysTimings.timings, todaysTimings.date.readable, true);
                            locationDisplay.textContent = `Location: Lat ${cached.latitude.toFixed(2)}, Lon ${cached.longitude.toFixed(2)}`;
                        } else {
                            displayError('Cached data available, but no times for today found.');
                        }
                    } else {
                        displayError('No cached data and location unavailable. Connect to internet and try again.');
                    }
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
            );
        } else {
            displayError('Geolocation is not supported by your browser. Cannot fetch new data.');
            locationDisplay.textContent = 'Geolocation not supported.';
            // Load from cache if browser doesn't support geolocation
            const cached = loadPrayerTimesFromCache();
            if (cached) {
                const todayDay = today.getDate();
                const todaysTimings = cached.timings.find(dayData => {
                    const apiDate = new Date(dayData.date.readable);
                    return apiDate.getDate() === todayDay;
                });
                if (todaysTimings) {
                    displayPrayerTimes(todaysTimings.timings, todaysTimings.date.readable, true);
                    locationDisplay.textContent = `Location: Lat ${cached.latitude.toFixed(2)}, Lon ${cached.longitude.toFixed(2)}`;
                } else {
                    displayError('Cached data available, but no times for today found.');
                }
            } else {
                displayError('No cached data and geolocation not supported. Cannot run.');
            }
        }
    }

    // Initial load
    initPrayerTimes();

    // Refresh button functionality
    refreshButton.addEventListener('click', () => {
        initPrayerTimes(true); // Force refresh
    });

    // PWA Service Worker Registration
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js')
                .then(registration => {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                })
                .catch(err => {
                    console.log('ServiceWorker registration failed: ', err);
                });
        });
    }
});