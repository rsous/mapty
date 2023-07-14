'use strict';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; // km
    this.duration = duration; // minutes
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence; // steps/min
    this.calcPace();
    this._setDescription();
  }
  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }
  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

//////////////////////////////////////////////////
// APPLICATION ARCHITECHTURE

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const overlay = document.querySelector('.overlay');
const modal = document.querySelector('.modal__edit');
const formEdit = document.querySelector('.modal__edit .form');
const resetBtn = document.querySelector('.delete-all');
const sortSelect = document.getElementById('sortSelect');
const sortContainer = document.querySelector('.sort');

class App {
  #map;
  #mapEvent;
  #workouts = [];
  #mapZoomLevel = 13;
  #formEditCallback;

  static validInputs(...inputs) {
    return inputs.every(inp => Number.isFinite(inp));
  }
  static allPositive(...inputs) {
    return inputs.every(inp => inp > 0);
  }

  constructor() {
    // Get user's position
    this.#getPosition();

    // Get data from localStorage
    this.#getLocalStorage();

    // Atach event handlers
    form.addEventListener('submit', this.#newWorkout.bind(this));
    inputType.addEventListener('change', this.#toggleElevationField);
    containerWorkouts.addEventListener('click', this.#moveToPopup.bind(this));
    containerWorkouts.addEventListener('click', this.#handleActions.bind(this));
    overlay.addEventListener('click', () => {
      this.#toggleModal();
      formEdit.removeEventListener('submit', this.#formEditCallback);
    });
    resetBtn.addEventListener('click', () => {
      const confirmation = confirm(
        'Do you want to delete all workout history?\nThis action cannot be undone.'
      );

      if (confirmation) this.reset();
    });
    sortSelect.addEventListener('change', this.#sort.bind(this));

    // Hide actions if there are no workouts
    this.#hideActions();
  }

  #getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this.#loadMap.bind(this),
        function () {
          alert('Could not get your position');
        }
      );
  }

  #loadMap(position) {
    const { latitude, longitude } = position.coords;
    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handling clicks on map
    this.#map.on('click', this.#showForm.bind(this));

    // Render markers from localStorage
    this.#workouts.forEach(work => {
      this.#renderWorkoutMarker(work);
    });
  }

  #showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  #hideForm() {
    // Clear input fields
    inputCadence.value =
      inputDistance.value =
      inputDuration.value =
      inputElevation.value =
        '';
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  #toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  #newWorkout(e) {
    e.preventDefault();

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // If workout type is running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;

      if (
        !App.validInputs(distance, duration, cadence) ||
        !App.allPositive(distance, duration, cadence)
      )
        return alert('Inputs must be positive numbers');

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // If workout type is cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;

      if (
        !App.validInputs(distance, duration, elevation) ||
        !App.allPositive(distance, duration)
      )
        return alert('Inputs must be positive numbers');

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // Add new object to workout array
    this.#workouts.push(workout);

    // Render workout on map as marker
    this.#renderWorkoutMarker(workout);

    // Render workout on list
    this.#renderWorkout(workout);

    // Hide form
    this.#hideForm();

    // Set local storage to all workouts
    this.#setLocalStorage();

    // Show delete button
    resetBtn.style.display = 'inline-block';
    sortContainer.style.display = 'flex';
  }

  #renderWorkoutMarker(workout) {
    L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃' : '🚴'} &nbsp` +
          workout.description
      )
      .openPopup();
  }

  #renderWorkout(workout) {
    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}" ">
        <h2 class="workout__title">${workout.description}</h2>
        <div class="workout__details">
          <span class="workout__icon">${
            workout.type === 'running' ? '🏃' : '🚴'
          }</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
    `;

    if (workout.type === 'running')
      html += `
          <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.pace.toFixed(1)}</span>
            <span class="workout__unit">min/km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">👣</span>
            <span class="workout__value">${workout.cadence}</span>
            <span class="workout__unit">spm</span>
          </div>
        
      `;
    if (workout.type === 'cycling')
      html += `
          <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.speed.toFixed(1)}</span>
            <span class="workout__unit">km/h</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⛰</span>
            <span class="workout__value">${workout.elevationGain}</span>
            <span class="workout__unit">m</span>
          </div>
        
      `;

    html += `
        <div class="workout__actions">
          <div class="workout__edit">
            <button><i class="fas fa-edit"></i></button>
          </div>
          <div class="workout__delete">
            <button><i class="fas fa-trash"></i></button>
          </div>
        </div>
      </li>
      `;

    form.insertAdjacentHTML('afterend', html);
  }

  #moveToPopup(e) {
    const workoutElement = e.target.closest('.workout');

    if (!workoutElement) return;

    const workout = this.#workouts.find(
      work => work.id === workoutElement.dataset.id
    );

    console.log(workout);

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: { duration: 1 },
    });
  }

  #setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  #getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    // Restoring the prototype chain of the objects coming from local storage
    data.forEach(work => {
      if (work.type === 'running') {
        work.__proto__ = Running.prototype;
      }
      if (work.type === 'cycling') {
        work.__proto__ = Cycling.prototype;
      }
    });

    this.#workouts = data;
    this.#workouts.forEach(work => {
      this.#renderWorkout(work);
    });
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }

  #handleActions(e) {
    const workoutElement = e.target.closest('.workout');
    if (!workoutElement) return;

    const workout = this.#workouts.find(
      work => work.id === workoutElement.dataset.id
    );
    const hiddenActions = document.querySelector(
      `[data-id="${workout.id}"] .workout__actions`
    );

    // If the click was on the action buttons
    if (
      e.target.classList.contains('fa-edit') ||
      e.target.classList.contains('fa-trash')
    ) {
      if (e.target.classList.contains('fa-edit')) {
        this.#editWorkout(workout);
      }
      if (e.target.classList.contains('fa-trash')) {
        this.#deleteWorkout(workout, workoutElement);
      }
    } else {
      // If the click was just on the workout
      hiddenActions.classList.toggle('active');
    }
  }

  #toggleModal() {
    overlay.classList.toggle('overlay-active');
    modal.classList.toggle('modal-active');
  }

  #setVariableModalField(type, label, input) {
    label.innerHTML = type === 'running' ? 'Cadence' : 'Elev Gain';
    input.placeholder = type === 'running' ? 'steps/min' : 'meters';
    input.classList.add(
      type === 'running' ? 'form__input--cadence' : 'form__input--elevation'
    );
    input.classList.remove(
      type === 'running' ? 'form__input--elevation' : 'form__input--cadence'
    );
  }

  #editWorkout(workout) {
    const label = document.querySelector(
      '.modal__edit .form__row.variable .form__label'
    );
    const input = document.querySelector(
      '.modal__edit .form__row.variable .form__input'
    );
    const distance = document.querySelector(
      '.modal__edit .form__input--distance'
    );
    const duration = document.querySelector(
      '.modal__edit .form__input--duration'
    );
    const variable = document.querySelector(
      '.modal__edit .form__row.variable .form__input'
    );

    this.#setVariableModalField(workout.type, label, input);
    this.#toggleModal();
    this.#setEditFormValues(workout, distance, duration, variable);
    // Creating wrapper function to pass arguments to the event handler
    const handlerSubmitWrappper = (workout, distance, duration, variable) => {
      return e => {
        this.#handleSubmitEditForm(e, workout, distance, duration, variable);
      };
    };
    // Setting private property to be able to remove the event listener later
    this.#formEditCallback = handlerSubmitWrappper(
      workout,
      distance,
      duration,
      variable
    );
    formEdit.addEventListener('submit', this.#formEditCallback);
  }

  #setEditFormValues(workout, distance, duration, variable) {
    distance.value = workout.distance;
    duration.value = workout.duration;
    variable.value =
      workout.type === 'running' ? workout.cadence : workout.elevationGain;
  }

  #handleSubmitEditForm(e, workout, inDistance, inDuration, inVariable) {
    e.preventDefault();
    const distance = +inDistance.value;
    const duration = +inDuration.value;
    const variable = +inVariable.value;

    console.log(distance, duration, variable);

    if (
      !App.validInputs(distance, duration, variable) ||
      !App.allPositive(distance, duration, variable)
    )
      return alert('Inputs must be positive numbers');

    if (
      workout.distance === distance &&
      workout.duration === duration &&
      (workout.cadence
        ? workout.cadence === variable
        : workout.elevationGain === variable)
    ) {
      formEdit.removeEventListener('submit', this.#formEditCallback);
      this.#toggleModal();
      return alert('No changes were made');
    }

    workout.distance = distance;
    workout.duration = duration;

    if (workout.type === 'running') {
      workout.cadence = variable;
      workout.calcPace();
    }
    if (workout.type === 'cycling') {
      workout.elevationGain = variable;
      workout.calcSpeed();
    }

    this.#setLocalStorage();
    this.#toggleModal();
    formEdit.removeEventListener('submit', this.#formEditCallback);
    location.reload();
  }

  #deleteWorkout(workout, workoutElement) {
    const confirmation = confirm(
      'Do you want to delete this workout permanently?\nThis action cannot be undone.'
    );
    if (!confirmation) return;

    this.#workouts = this.#workouts.filter(work => work.id !== workout.id);
    workoutElement.remove();
    this.#setLocalStorage();
    location.reload();
  }

  #hideActions() {
    if (this.#workouts.length < 1) {
      resetBtn.style.display = 'none';
      sortContainer.style.display = 'none';
    }
  }

  #sortByDate(position) {
    const compareDates = (a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);

      if (
        position === 'recentLast'
          ? dateA
          : dateB > position === 'recentLast'
          ? dateB
          : dateA
      )
        return -1;
      if (
        position === 'recentLast'
          ? dateA
          : dateB < position === 'recentLast'
          ? dateB
          : dateA
      )
        return 1;
      return 0;
    };
    this.#workouts.sort(compareDates);
  }

  #sortByNumbers(property) {
    const compareNumbers = (a, b) => {
      return a[property] - b[property];
    };
    this.#workouts.sort(compareNumbers);
  }

  #sort() {
    if (
      sortSelect.value === 'recentLast' ||
      sortSelect.value === 'recentFirst'
    ) {
      this.#sortByDate(sortSelect.value);
    }
    if (sortSelect.value === 'duration' || sortSelect.value === 'distance') {
      this.#sortByNumbers(sortSelect.value);
    }
    this.#setLocalStorage();
    location.reload();
  }
}

const app = new App();
