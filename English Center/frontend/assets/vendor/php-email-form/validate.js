/**
* PHP Email Form Validation - v3.11
* URL: https://bootstrapmade.com/php-email-form/
* Author: BootstrapMade.com
*/
(function () {
  "use strict";

  let forms = document.querySelectorAll('.php-email-form');

  forms.forEach( function(e) {
    e.addEventListener('submit', function(event) {
      event.preventDefault();

      let thisForm = this;

      let action = thisForm.getAttribute('action');
      let recaptcha = thisForm.getAttribute('data-recaptcha-site-key');
      
      if( ! action ) {
        displayError(thisForm, 'The form action property is not set!');
        return;
      }
      setFormState(thisForm, 'loading');

      let formData = new FormData( thisForm );

      if (shouldUseDemoSubmit(action)) {
        demoSubmit(thisForm, formData);
        return;
      }

      if ( recaptcha ) {
        if(typeof grecaptcha !== "undefined" ) {
          grecaptcha.ready(function() {
            try {
              grecaptcha.execute(recaptcha, {action: 'php_email_form_submit'})
              .then(token => {
                formData.set('recaptcha-response', token);
                php_email_form_submit(thisForm, action, formData);
              })
            } catch(error) {
              displayError(thisForm, error);
            }
          });
        } else {
          displayError(thisForm, 'The reCaptcha javascript API url is not loaded!')
        }
      } else {
        php_email_form_submit(thisForm, action, formData);
      }
    });
  });

  function php_email_form_submit(thisForm, action, formData) {
    fetch(action, {
      method: 'POST',
      body: formData,
      headers: {'X-Requested-With': 'XMLHttpRequest'}
    })
    .then(response => {
      if( response.ok ) {
        return response.text();
      } else {
        throw new Error(`${response.status} ${response.statusText} ${response.url}`); 
      }
    })
    .then(data => {
      setFormState(thisForm, 'idle');
      if (data.trim() == 'OK') {
        showSuccess(thisForm);
        thisForm.reset(); 
      } else {
        throw new Error(data ? data : 'Form submission failed and no error message returned from: ' + action); 
      }
    })
    .catch((error) => {
      displayError(thisForm, error);
    });
  }

  function shouldUseDemoSubmit(action) {
    return window.location.protocol === 'file:' || action.indexOf('forms/') === 0;
  }

  function demoSubmit(thisForm, formData) {
    window.setTimeout(function() {
      const data = Object.fromEntries(formData.entries());

      if (window.EC_API && window.location.protocol !== 'file:') {
        window.EC_API.contact({
          type: thisForm.getAttribute('action') && thisForm.getAttribute('action').includes('newsletter') ? 'newsletter' : 'contact',
          ...data
        }).catch(function() {
          saveDemoSubmission(thisForm, data);
        });
      } else {
        saveDemoSubmission(thisForm, data);
      }

      setFormState(thisForm, 'idle');
      showSuccess(thisForm);
      thisForm.reset();
    }, 500);
  }

  function saveDemoSubmission(thisForm, data) {
      try {
        let submissions = JSON.parse(localStorage.getItem('ec_form_submissions') || '[]');
        submissions.unshift({
          page: window.location.pathname.split('/').pop() || 'index.html',
          action: thisForm.getAttribute('action'),
          createdAt: new Date().toISOString(),
          data: data
        });
        localStorage.setItem('ec_form_submissions', JSON.stringify(submissions.slice(0, 50)));
      } catch (error) {
        // localStorage can be unavailable in private browsing; form UX should still complete.
      }
  }

  function setFormState(thisForm, state) {
    const loading = thisForm.querySelector('.loading');
    const error = thisForm.querySelector('.error-message');
    const sent = thisForm.querySelector('.sent-message');

    if (loading) loading.classList.toggle('d-block', state === 'loading');
    if (error) {
      error.classList.remove('d-block');
      error.innerHTML = '';
    }
    if (sent) sent.classList.remove('d-block');
  }

  function showSuccess(thisForm) {
    const sent = thisForm.querySelector('.sent-message');
    if (sent) sent.classList.add('d-block');
  }

  function displayError(thisForm, error) {
    setFormState(thisForm, 'idle');
    const errorElement = thisForm.querySelector('.error-message');
    if (errorElement) {
      errorElement.innerHTML = error;
      errorElement.classList.add('d-block');
    }
  }

})();
