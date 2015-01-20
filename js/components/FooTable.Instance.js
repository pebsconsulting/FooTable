(function ($, FooTable) {

	/**
	 * An array of all currently loaded instances of the plugin.
	 * @type {Array.<FooTable.Instance>}
	 */
	FooTable.instances = [];

	FooTable.Instance = FooTable.Class.extend(/** @lends FooTable.Instance */{
		/**
		 * This class is the core of the plugin and drives the logic of all components and addons.
		 * @constructs
		 * @extends FooTable.Class
		 * @param {HTMLTableElement} element - The element to bind the plugin to.
		 * @param {object} options - The options to initialize the plugin with.
		 * @returns {FooTable.Instance}
		 */
		ctor: function (element, options) {
			var self = this;
			//BEGIN MEMBERS
			/**
			 * The timeout ID for the resize event.
			 * @instance
			 * @type {?number}
			 * @private
			 */
			this._resizeTimeout = null;
			/**
			 * The callback function to execute once fully initialized.
			 * @instance
			 * @type {function}
			 * @default jQuery.noop
			 * @private
			 */
			this._ready = $.noop;
			/**
			 * The ID of the FooTable instance.
			 * @instance
			 * @type {number}
			 */
			this.id = FooTable.instances.push(self);
			/**
			 * Whether or not the plugin and all components and add-ons are fully initialized.
			 * @instance
			 * @type {boolean}
			 */
			this.initialized = false;
			/**
			 * The jQuery table object the plugin is bound to.
			 * @instance
			 * @type {jQuery}
			 */
			this.$table = $(element);
			/**
			 * The jQuery style object containing any CSS styles for this instance of the plugin.
			 * @instance
			 * @type {jQuery}
			 */
			this.$styles = $('<style/>', { type: 'text/css' }).appendTo('head');
			/**
			 * The jQuery row object that serves as the loader for the plugin.
			 * @instance
			 * @type {jQuery}
			 */
			this.$loader = null;
			/**
			 * The options the plugin is initialized with.
			 * @instance
			 * @type {object}
			 */
			this.options = $.extend(true, {}, FooTable.defaults, options);
			/**
			 * The breakpoints component for this instance of the plugin.
			 * @instance
			 * @type {FooTable.Breakpoints}
			 */
			this.breakpoints = new FooTable.Breakpoints(self);
			/**
			 * The columns component for this instance of the plugin.
			 * @instance
			 * @type {FooTable.Columns}
			 */
			this.columns = new FooTable.Columns(self);
			/**
			 * The rows component for this instance of the plugin.
			 * @instance
			 * @type {FooTable.Rows}
			 */
			this.rows = new FooTable.Rows(self);
			/**
			 * The filtering component for this instance of the plugin.
			 * @instance
			 * @type {FooTable.Filtering}
			 */
			this.filtering = new FooTable.Filtering(self);
			/**
			 * The sorting component for this instance of the plugin.
			 * @instance
			 * @type {FooTable.Sorting}
			 */
			this.sorting = new FooTable.Sorting(self);
			/**
			 * The paging component for this instance of the plugin.
			 * @instance
			 * @type {FooTable.Paging}
			 */
			this.paging = new FooTable.Paging(self);

			/**
			 * The components for this instance of the plugin. These are executed in the order they appear in the array for the initialize phase and in reverse order for the destroy phase of the plugin.
			 * @instance
			 * @type {object}
			 * @prop {Array.<FooTable.Component>} internal - The internal components for the plugin. These are executed either before all other components in the initialize phase or after them in the destroy phase of the plugin.
			 * @prop {Array.<FooTable.Component>} core - The core components for the plugin. These are executed either after the internal components in the initialize phase or before them in the destroy phase of the plugin.
			 * @prop {Array.<FooTable.AddOn>} addons - The addon components for the plugin. These are executed either after the core components in the initialize phase or before them in the destroy phase of the plugin.
			 */
			this.components = {
				internal: [self.breakpoints, self.columns, self.rows],
				core: [self.filtering, self.sorting, self.paging],
				addons: FooTable.addons.ctor(self)
			};
			//END MEMBERS
			self._init(element, self.options);
		},
		/**
		 * Initializes this instance of the plugin with the supplied element and options.
		 * @instance
		 * @private
		 * @param {HTMLElement} element - The table element to initialize the plugin on.
		 * @param {object} options - The options to initialize the plugin with.
		 * @return {jQuery.Promise}
		 * @fires FooTable.Instance#preinit
		 * @fires FooTable.Instance#init
		 */
		_init: function(element, options){
			var self = this;
			if (typeof options.on === 'object') self.$table.on(options.on);
			self.$table.addClass('footable-' + self.id);
			self.when(false, true, 'preinit', element, options).then(function () {
				/**
				 * The preinit event is raised before any core components or add-ons are initialized.
				 * @event FooTable.Instance#preinit
				 * @param {jQuery.Event} e - The jQuery.Event object for the event.
				 * @param {FooTable.Instance} instance - The instance of the plugin raising the event.
				 */
				if (self.raise('preinit').isDefaultPrevented()) throw FooTable.ExitEarly;
				return self.when(false, true, 'init', element, options).then(function(){
					self.$loader = $('<tr/>', { 'class': 'footable-loader' }).append($('<td/>').attr('colspan', self.columns.colspan()).append($('<span/>', {'class': 'glyphicon glyphicon-repeat'})));
					self.initialized = true;
					/**
					 * The init event is raised after all core components and add-ons are initialized.
					 * @event FooTable.Instance#init
					 * @param {jQuery.Event} e - The jQuery.Event object for the event.
					 * @param {FooTable.Instance} instance - The instance of the plugin raising the event.
					 */
					self.raise('init');
					self._ready.call(self, self);
				});
			}).then(function () {
				self.update();
				$(window).off('resize', self._onWindowResize).on('resize', { self: self }, self._onWindowResize);
			}, function (err) {
				if (err instanceof FooTable.ExitEarly) return;
				console.error(err);
			});
		},
		/**
		 * Reinitializes this instance of the plugin with the supplied options.
		 * @instance
		 * @param {object} options - The options to reinitialize the plugin with.
		 * @return {jQuery.Promise}
		 * @fires FooTable.Instance#reinit
		 */
		reinit: function (options) {
			var self = this;
			self.initialized = false;
			self.$loader.remove();
			self.clearCSSRules();
			// cleanup any previously bound events before we merge the new options with the old
			if (typeof self.options.on === 'object') self.$table.off(self.options.on);
			$.extend(true, self.options, options);

			if (typeof self.options.on === 'object') self.$table.on(self.options.on);
			self.$table.addClass('footable-' + self.id);
			return self.when(false, true, 'reinit', self.options).then(function () {
				self.$loader = $('<tr/>', { 'class': 'footable-loader' }).append($('<td/>').attr('colspan', self.columns.colspan()).append($('<span/>', {'class': 'glyphicon glyphicon-repeat'})));
				self.initialized = true;
				/**
				 * The reinit event is raised after all core components are reinitialized.
				 * @event FooTable.Instance#reinit
				 * @param {jQuery.Event} e - The jQuery.Event object for the event.
				 * @param {FooTable.Instance} instance - The instance of the plugin raising the event.
				 */
				self.raise('reinit');
			}).then(function () {
				self.update();
				$(window).off('resize', self._onWindowResize).on('resize', { self: self }, self._onWindowResize);
			}, function (err) {
				console.error(err);
			});
		},
		/**
		 * Destroys this plugin removing it from the table.
		 * @instance
		 * @fires FooTable.Instance#destroy
		 */
		destroy: function () {
			var self = this;
			return self.when(true, false, 'destroy').then(function () {
				self.clearCSSRules();
				/**
				 * The destroy event is called after all core components and add-ons have destroyed themselves.
				 * @event FooTable.Instance#destroy
				 * @param {jQuery.Event} e - The jQuery.Event object for the event.
				 * @param {FooTable.Instance} instance - The instance of the plugin raising the event.
				 */
				self.raise('destroy');
				if (typeof self.options.on === 'object') self.$table.off(self.options.on);
			});
		},
		/**
		 * Executes the ajax function and loads the response into the plugin.
		 * @instance
		 * @returns {jQuery.Promise}
		 * @fires FooTable.Instance#preajax
		 * @fires FooTable.Instance#postajax
		 */
		ajax: function () {
			var self = this, request = new FooTable.RequestData(),
				$header = self.$table.children('thead').children('tr.footable-header'),
				$tbody = self.$table.children('tbody'),
				height = $tbody.height();

			height = height > 0 ? $header.height() + height : 150;
			// show the loader
			self.$loader.children('td').height(height);
			$header.hide();
			$tbody.children('tr').detach();
			$tbody.append(self.$loader);

			return self.when(false, false, 'preajax', request).then(function () {
				/**
				 * The preajax event is raised before the actual Ajax request is made and is passed the request data object.
				 * @event FooTable.Instance#preajax
				 * @param {jQuery.Event} e - The jQuery.Event object for the event.
				 * @param {FooTable.Instance} instance - The instance of the plugin raising the event.
				 * @param {FooTable.RequestData} requestData - The request data object that will be supplied to the {@link FooTable.Defaults#ajax} function.
				 */
				if (self.raise('preajax', [request]).isDefaultPrevented()) throw FooTable.ExitEarly;
				return self.options.ajax(request).then(function (response) {
					return self.when(false, false, 'postajax', response).then(function(){
						/**
						 * The postajax event is raised after the Ajax request is made and is passed the response.
						 * @event FooTable.Instance#postajax
						 * @param {jQuery.Event} e - The jQuery.Event object for the event.
						 * @param {FooTable.Instance} instance - The instance of the plugin raising the event.
						 * @param {object} response - The JSON response object returned from the {@link FooTable.Defaults#ajax} function.
						 */
						self.raise('postajax', [response]);
						// hide the loader
						self.$table.children('thead').children('tr.footable-header').show();
						self.$loader.detach();
					});
				});
			});
		},
		/**
		 * Performs the drawing of the table.
		 * @instance
		 * @returns {jQuery.Promise}
		 * @fires FooTable.Instance#predraw
		 * @fires FooTable.Instance#draw
		 * @fires FooTable.Instance#postdraw
		 */
		draw: function () {
			var self = this;
			// when drawing the order that the components are executed is important so chain the methods but use promises to retain async safety.
			return self.when(false, true, 'predraw').then(function(){
				/**
				 * The predraw event is raised after all core components and add-ons have executed there predraw functions but before they execute there draw functions.
				 * @event FooTable.Instance#predraw
				 * @param {jQuery.Event} e - The jQuery.Event object for the event.
				 * @param {FooTable.Instance} instance - The instance of the plugin raising the event.
				 */
				if (self.raise('predraw').isDefaultPrevented()) throw FooTable.ExitEarly;
				return self.when(false, true, 'draw').then(function(){
					self.$loader.children('td').attr('colspan', self.columns.colspan());
					/**
					 * The draw event is raised after all core components and add-ons have executed there draw functions.
					 * @event FooTable.Instance#draw
					 * @param {jQuery.Event} e - The jQuery.Event object for the event.
					 * @param {FooTable.Instance} instance - The instance of the plugin raising the event.
					 */
					if (self.raise('draw').isDefaultPrevented()) throw FooTable.ExitEarly;
					return self.when(false, true, 'postdraw').then(function(){
						self.$loader.children('td').attr('colspan', self.columns.colspan());
						/**
						 * The postdraw event is raised after all core components and add-ons have executed there postdraw functions.
						 * @event FooTable.Instance#postdraw
						 * @param {jQuery.Event} e - The jQuery.Event object for the event.
						 * @param {FooTable.Instance} instance - The instance of the plugin raising the event.
						 */
						self.raise('postdraw');
					});
				});
			});
		},
		/**
		 * Performs an update for the table calling the ajax function if required and then drawing.
		 * @instance
		 * @returns {jQuery.Promise}
		 */
		update: function () {
			var self = this;
			if (self.options.ajaxEnabled == true) {
				return self.ajax().then(function () {
					return self.draw();
				}, function (err) {
					console.error(err);
				});
			} else {
				return self.draw();
			}
		},
		/**
		 * Executes the specified method with the optional number of parameters on all components.
		 * @instance
		 * @param {string} methodName - The name of the method to execute.
		 * @param {*} [param1] - The first parameter for the method.
		 * @param {...*} [paramN] - Any number of additional parameters for the method.
		 * @returns {jQuery.Promise} A jQuery Promise object containing promises for each of the executed methods.
		 */
		execute: function (methodName, param1, paramN) {
			var self = this,
				args = Array.prototype.slice.call(arguments),
				components = self.components.internal.concat(self.components.core, self.components.internal);
			methodName = args.shift();
			$.each(components, function(i, component){
				if (component[methodName] && typeof component[methodName] === 'function') {
					component[methodName].apply(component, args);
				}
			});
		},
		/**
		 * Executes the specified method with the optional number of parameters on all components and waits for all promises to be resolved.
		 * @instance
		 * @param {boolean} reverse - Whether or not to execute the component methods in the reverse order to what they were registered in.
		 * @param {boolean} chain - Whether or not to chain all the method calls waiting for the result of the first before calling the second and so on.
		 * @param {string} methodName - The name of the method to execute.
		 * @param {*} [param1] - The first parameter for the method.
		 * @param {...*} [paramN] - Any number of additional parameters for the method.
		 * @returns {jQuery.Promise} A jQuery Promise object containing promises for each of the executed methods.
		 */
		when: function(reverse, chain, methodName, param1, paramN){
			var self = this, args = Array.prototype.slice.call(arguments);
			reverse = args.shift();
			chain = args.shift();
			var exec = chain ? self._chain : self._when;
			args.unshift(reverse ? self.components.addons.slice(0).reverse() : self.components.internal.slice(0));
			return exec.apply(self, args).then(function(){
				args.shift();
				args.unshift(reverse ? self.components.core.slice(0).reverse() : self.components.core.slice(0));
				return exec.apply(self, args).then(function(){
					args.shift();
					args.unshift(reverse ? self.components.internal.slice(0).reverse() : self.components.addons.slice(0));
					return exec.apply(self, args);
				});
			});
		},
		/**
		 * Executes the specified method with the optional number of parameters on all supplied components.
		 * @param {Array.<FooTable.Component>} components - The components to call the method on.
		 * @param {string} methodName - The name of the method to execute
		 * @param {*} [param1] - The first parameter for the method.
		 * @param {...*} [paramN] - Any additional parameters for the method.
		 * @returns {jQuery.Promise} A jQuery Promise object containing promises for each of the executed methods.
		 */
		_when: function (components, methodName, param1, paramN) {
			if (!components || !components.length) return $.when();
			var args = Array.prototype.slice.call(arguments),
				methods = [];
			components = args.shift();
			methodName = args.shift();
			$.each(components, function(i, component){
				if (component[methodName] && typeof component[methodName] === 'function') {
					methods.push(component[methodName].apply(component, args));
				}
			});
			return $.when.apply($, methods);
		},
		/**
		 * Executes the specified method with the optional number of parameters on all supplied components waiting for the result of each before executing the next.
		 * @param {Array.<FooTable.Component>} components - The components to call the method on.
		 * @param {string} methodName - The name of the method to execute
		 * @param {*} [param1] - The first parameter for the method.
		 * @param {...*} [paramN] - Any additional parameters for the method.
		 * @returns {jQuery.Promise} A jQuery Promise object containing promises for each of the executed methods.
		 */
		_chain: function(components, methodName, param1, paramN){
			if (!components || !components.length) return $.when();
			var self = this, args = Array.prototype.slice.call(arguments),
				component;
			components = args.shift();
			methodName = args.shift();
			component = components.shift();
			return $.when(component[methodName].apply(component, args)).then(function(){
				return self._chain(components, methodName, param1, paramN);
			});
		},
		/**
		 * Raises an event on this instance supplying the args array as additional parameters to the handlers.
		 * @instance
		 * @param {string} eventName - The name of the event to raise, this can include namespaces.
		 * @param {Array} [args] - An array containing additional parameters to be passed to any bound handlers.
		 * @returns {jQuery.Event} The jQuery.Event object used to raise the event.
		 */
		raise: function (eventName, args) {
			args = args || [];
			args.unshift(this);
			if (!FooTable.utils.strings.isNullOrEmpty(this.options.namespace) && !FooTable.utils.strings.contains(eventName, '.')) {
				eventName = FooTable.utils.strings.join('.', eventName, this.options.namespace);
			}
			var evt = $.Event(eventName);
			this.$table.one(eventName, function (e) {e.stopPropagation();}).trigger(evt, args);
			return evt;
		},
		/**
		 * This method is called once the entire plugin is initialized.
		 * @instance
		 * @param {function} callback - The function to execute once the entire plugin is initialized.
		 */
		ready: function (callback) {
			if (typeof callback !== 'function') return;
			this._ready = callback;
			if (this.initialized === true) callback.call(this, this);
		},
		/**
		 * Clears all rules from this instances' {@link FooTable.Instance#$styles} tag.
		 * @instance
		 */
		clearCSSRules: function(){
			this.$styles.html('');
		},
		/**
		 * Adds the supplied selector and cssText to this instances' {@link FooTable.Instance#$styles} tag.
		 * @instance
		 * @param {string} selector - The rule selector to append.
		 * @param {string} cssText - The cssText for the selector.
		 */
		addCSSRule: function(selector, cssText){
			var style = this.$styles.get(0), sheet = style.styleSheet || style.sheet;
			if (sheet.insertRule){
				sheet.insertRule(selector + " { " + cssText + " }", sheet.cssRules.length);
			} else {
				sheet.addRule(selector, cssText, -1);
			}
		},
		/**
		 * Listens to the window resize event and performs a check to see if the breakpoint has changed.
		 * @instance
		 * @private
		 * @fires FooTable.Instance#resize
		 */
		_onWindowResize: function (e) {
			var self = e.data.self;
			if (self._resizeTimeout != null) { clearTimeout(self._resizeTimeout); }
			self._resizeTimeout = setTimeout(function () {
				self._resizeTimeout = null;
				/**
				 * The resize event is raised a short time after window resize operations cease.
				 * @event FooTable.Instance#resize
				 * @param {jQuery.Event} e - The jQuery.Event object for the event.
				 * @param {FooTable.Instance} instance - The instance of the plugin raising the event.
				 */
				if (!self.raise('resize').isDefaultPrevented()) {
					self.breakpoints.check();
				}
			}, 300);
		}
	});

	FooTable.RequestData = FooTable.Class.extend(/** @lends FooTable.RequestData */{
		/**
		 * The request data object is passed to the {@link FooTable.Defaults#ajax} method and contains all information required to make the ajax request.
		 * @constructs
		 * @extends FooTable.Class
		 * @returns {FooTable.RequestData}
		 */
		ctor: function(){}
	});

	FooTable.ResponseData = FooTable.Class.extend(/** @lends FooTable.ResponseData */{
		/**
		 * The response object that the plugin expects back from the {@link FooTable.Defaults#ajax} method.
		 * @constructs
		 * @extends FooTable.Class
		 * @returns {FooTable.ResponseData}
		 */
		ctor: function(){}
	});

})(jQuery, FooTable = window.FooTable || {});