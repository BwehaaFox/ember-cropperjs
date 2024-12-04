import { compare } from '@ember/utils';
import { action } from '@ember/object';
import { join, scheduleOnce } from '@ember/runloop';
import { setProperties, set, get } from '@ember/object';
import Component from '@ember/component';
import layout from '../templates/components/image-cropper';

// Properties that do not require a new Cropper instance, rather just need to call
// a method on the existing instance
const OPT_UPDATE_METHODS = {
  'aspectRatio': 'setAspectRatio'
};

// Properties that require a completely new Cropper instance
const OPTS_REQUIRE_NEW = [
  'cropBoxResizable',
  'cropBoxMovable',
  'zoomable'
];

/**
  A component that renders a cropper.
  ```hbs
  {{#image-cropper
    alt='sinbad'
    source='sinbad.jpg'
    options=(hash
      viewMode=2
      width=256
      height=256)}}

  {{!-- yielded content --}}

  {{/image-cropper}}
  ```
  @class ImageCropper
  @public
*/
export default class CropperJsComponent extends Component.extend({
  classNames: [ 'image-cropper' ],
  layout,

  /**
    The attribute defining the alternative text describing the cropper canvas.

    @argument alt
    @type String
  */
  alt: null,

  /**
    The image source to crop.

    @argument source
    @type String
  */
  source: null,

  /**
    The options to pass down to the Cropper.js instance. Use [Cropper.js options](https://github.com/fengyuanchen/cropperjs#options)
    for reference.

    @argument options
    @type Object
  */
  options: null,

  _Cropper: null,
  ccropper: null,
  _prevOptions: null,
  _prevSource: null,

  didInsertElement() {
    this._super(...arguments);

    scheduleOnce('afterRender', this, this._setup);
  },

  didUpdateAttrs() {
    this._super(...arguments);

    const { ccropper } = this;

    if (ccropper === null || this._Cropper === null) {
      return;
    }

    // Check if the image source changed
    if (compare(get(this, 'source'), get(this, '_prevSource')) !== 0) {
      const source = get(this, 'source');

      ccropper.replace(source);
      set(this, '_prevSource', source);
    }

    const options = get(this, 'options');

    if (!options) {
      return;
    }

    // Requires to destroy and re-instantiate a new Cropper instance
    if (window && window.document) {
      if (OPTS_REQUIRE_NEW.some((opt) => compare(options[opt], this._prevOptions[opt]) !== 0)) {
        // Note that .getData() will fail unless the cropper is already ready
        const shouldRetainData = ccropper.ready;
        const data = shouldRetainData ? ccropper.getData() : null;
        const canvasData = shouldRetainData ? ccropper.getCanvasData() : null;

        ccropper.destroy();

        const opts = {...options};
        const source = get(this, 'source');
        const image = document.getElementById(`image-cropper-${get(this, 'elementId')}`);
        const newCropper = new this._Cropper(image, opts)

        if (shouldRetainData) {
          // Reset state that would be lost after re-initializing
          const reloadData = function() {
            newCropper.setCanvasData(canvasData);

            // According to the CropperJS docs, setData is only available if
            // viewMode is 1 or greater
            if (options.viewMode && options.viewMode >= 1) {
              newCropper.setData(data);
            }

            // Only need to do this once!
            image.removeEventListener("ready", reloadData, false);
          };

          // We use the event listener instead of CropperJS's ready shortcut,
          // so that this doesn't override the options hash
          image.addEventListener("ready", reloadData, false);

          // Reload the image after init - this part shouldn't be in the ready
          // callback
          if (source) newCropper.replace(source);
        }

        setProperties(this, {
          _prevOptions: opts,
          ccropper: newCropper
        });

        return;
      }
    }

    // Diff the `options` hash for changes
    for (const opt in OPT_UPDATE_METHODS) {
      if (compare(options[opt], this._prevOptions[opt]) !== 0) {
        ccropper[OPT_UPDATE_METHODS[opt]](options[opt]);
      }
    }

    set(this, '_prevOptions', {...options});
  },

  willDestroyElement() {
    this._super(...arguments);

    const ccropper = get(this, 'ccropper');
    if (ccropper !== null) {
      ccropper.destroy();
    }
  },

  _setup(e) {
    if (this.isDestroyed || this.isDestroying || !this.element || this._Cropper === null || this.ccropper !== null) {
      return;
    }
    if (window && window.document) {
      const image = e;
      const options = get(this, 'options');

      // Need a copy because Cropper does not seem to like the Ember EmptyObject that is created from the `{{hash}}` helper
      const opts = {...options};

      setProperties(this, {
        ccropper: new this._Cropper(image, opts),
        _prevOptions: opts,
        _prevSource: get(this, 'source')
      });
    }
  }
}) {
  @action
  initCrop(e) {
    if (window && window.document) {
      import('cropperjs').then((module) => {
        this._Cropper = module.default;
        join(() => this._setup(e));
      });
    }
  }
}
