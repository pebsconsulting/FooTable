(function($, FooTable){

	FooTable.Row = FooTable.Class.extend(/** @lends FooTable.Row */{
		/**
		 * The row class containing all the properties for a row and its' cells.
		 * @constructs
		 * @extends FooTable.Class
		 * @param {FooTable.Instance} instance -  The parent {@link FooTable.Instance} this component belongs to.
		 * @param {HTMLElement} row - The row element this object wraps.
		 * @param {Array.<FooTable.Column>} columns - The array of {@link FooTable.Column} for this row.
		 * @returns {FooTable.Row}
		 */
		ctor: function (instance, row, columns) {
			/**
			 * The {@link FooTable.Instance} for the row.
			 * @type {FooTable.Instance}
			 */
			this.instance = instance;
			/**
			 * The jQuery row object.
			 * @type {jQuery}
			 */
			this.$row = $(row);
			/**
			 * The array of {@link FooTable.Column} for this row.
			 * @type {Array.<FooTable.Column>}
			 */
			this.columns = columns;
			/**
			 * The cells array.
			 * @type {Array.<FooTable.Cell>}
			 */
			this.cells = [];

			// add this object to the row
			this.$row.get(0).__FooTable_Row__ = this;

			this.instance.execute('ctor_row', this);
		}
	});

})(jQuery, FooTable = window.FooTable || {});