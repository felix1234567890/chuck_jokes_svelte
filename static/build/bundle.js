
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
	'use strict';

	/** @returns {void} */
	function noop() {}

	/**
	 * @template T
	 * @template S
	 * @param {T} tar
	 * @param {S} src
	 * @returns {T & S}
	 */
	function assign(tar, src) {
		// @ts-ignore
		for (const k in src) tar[k] = src[k];
		return /** @type {T & S} */ (tar);
	}

	// Adapted from https://github.com/then/is-promise/blob/master/index.js
	// Distributed under MIT License https://github.com/then/is-promise/blob/master/LICENSE
	/**
	 * @param {any} value
	 * @returns {value is PromiseLike<any>}
	 */
	function is_promise(value) {
		return (
			!!value &&
			(typeof value === 'object' || typeof value === 'function') &&
			typeof (/** @type {any} */ (value).then) === 'function'
		);
	}

	function run(fn) {
		return fn();
	}

	function blank_object() {
		return Object.create(null);
	}

	/**
	 * @param {Function[]} fns
	 * @returns {void}
	 */
	function run_all(fns) {
		fns.forEach(run);
	}

	/**
	 * @param {any} thing
	 * @returns {thing is Function}
	 */
	function is_function(thing) {
		return typeof thing === 'function';
	}

	/** @returns {boolean} */
	function safe_not_equal(a, b) {
		return a != a ? b == b : a !== b || (a && typeof a === 'object') || typeof a === 'function';
	}

	/** @returns {boolean} */
	function is_empty(obj) {
		return Object.keys(obj).length === 0;
	}

	function subscribe(store, ...callbacks) {
		if (store == null) {
			for (const callback of callbacks) {
				callback(undefined);
			}
			return noop;
		}
		const unsub = store.subscribe(...callbacks);
		return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
	}

	/** @returns {void} */
	function component_subscribe(component, store, callback) {
		component.$$.on_destroy.push(subscribe(store, callback));
	}

	function create_slot(definition, ctx, $$scope, fn) {
		if (definition) {
			const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
			return definition[0](slot_ctx);
		}
	}

	function get_slot_context(definition, ctx, $$scope, fn) {
		return definition[1] && fn ? assign($$scope.ctx.slice(), definition[1](fn(ctx))) : $$scope.ctx;
	}

	function get_slot_changes(definition, $$scope, dirty, fn) {
		if (definition[2] && fn) {
			const lets = definition[2](fn(dirty));
			if ($$scope.dirty === undefined) {
				return lets;
			}
			if (typeof lets === 'object') {
				const merged = [];
				const len = Math.max($$scope.dirty.length, lets.length);
				for (let i = 0; i < len; i += 1) {
					merged[i] = $$scope.dirty[i] | lets[i];
				}
				return merged;
			}
			return $$scope.dirty | lets;
		}
		return $$scope.dirty;
	}

	/** @returns {void} */
	function update_slot_base(
		slot,
		slot_definition,
		ctx,
		$$scope,
		slot_changes,
		get_slot_context_fn
	) {
		if (slot_changes) {
			const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
			slot.p(slot_context, slot_changes);
		}
	}

	/** @returns {any[] | -1} */
	function get_all_dirty_from_scope($$scope) {
		if ($$scope.ctx.length > 32) {
			const dirty = [];
			const length = $$scope.ctx.length / 32;
			for (let i = 0; i < length; i++) {
				dirty[i] = -1;
			}
			return dirty;
		}
		return -1;
	}

	/** @returns {{}} */
	function exclude_internal_props(props) {
		const result = {};
		for (const k in props) if (k[0] !== '$') result[k] = props[k];
		return result;
	}

	/** @returns {{}} */
	function compute_rest_props(props, keys) {
		const rest = {};
		keys = new Set(keys);
		for (const k in props) if (!keys.has(k) && k[0] !== '$') rest[k] = props[k];
		return rest;
	}

	function set_store_value(store, ret, value) {
		store.set(value);
		return ret;
	}

	function action_destroyer(action_result) {
		return action_result && is_function(action_result.destroy) ? action_result.destroy : noop;
	}

	/** @type {typeof globalThis} */
	const globals =
		typeof window !== 'undefined'
			? window
			: typeof globalThis !== 'undefined'
			? globalThis
			: // @ts-ignore Node typings have this
			  global;

	/**
	 * @param {Node} target
	 * @param {Node} node
	 * @returns {void}
	 */
	function append(target, node) {
		target.appendChild(node);
	}

	/**
	 * @param {Node} target
	 * @param {Node} node
	 * @param {Node} [anchor]
	 * @returns {void}
	 */
	function insert(target, node, anchor) {
		target.insertBefore(node, anchor || null);
	}

	/**
	 * @param {Node} node
	 * @returns {void}
	 */
	function detach(node) {
		if (node.parentNode) {
			node.parentNode.removeChild(node);
		}
	}

	/**
	 * @returns {void} */
	function destroy_each(iterations, detaching) {
		for (let i = 0; i < iterations.length; i += 1) {
			if (iterations[i]) iterations[i].d(detaching);
		}
	}

	/**
	 * @template {keyof HTMLElementTagNameMap} K
	 * @param {K} name
	 * @returns {HTMLElementTagNameMap[K]}
	 */
	function element(name) {
		return document.createElement(name);
	}

	/**
	 * @template {keyof SVGElementTagNameMap} K
	 * @param {K} name
	 * @returns {SVGElement}
	 */
	function svg_element(name) {
		return document.createElementNS('http://www.w3.org/2000/svg', name);
	}

	/**
	 * @param {string} data
	 * @returns {Text}
	 */
	function text(data) {
		return document.createTextNode(data);
	}

	/**
	 * @returns {Text} */
	function space() {
		return text(' ');
	}

	/**
	 * @returns {Text} */
	function empty() {
		return text('');
	}

	/**
	 * @param {EventTarget} node
	 * @param {string} event
	 * @param {EventListenerOrEventListenerObject} handler
	 * @param {boolean | AddEventListenerOptions | EventListenerOptions} [options]
	 * @returns {() => void}
	 */
	function listen$1(node, event, handler, options) {
		node.addEventListener(event, handler, options);
		return () => node.removeEventListener(event, handler, options);
	}

	/**
	 * @param {Element} node
	 * @param {string} attribute
	 * @param {string} [value]
	 * @returns {void}
	 */
	function attr(node, attribute, value) {
		if (value == null) node.removeAttribute(attribute);
		else if (node.getAttribute(attribute) !== value) node.setAttribute(attribute, value);
	}
	/**
	 * List of attributes that should always be set through the attr method,
	 * because updating them through the property setter doesn't work reliably.
	 * In the example of `width`/`height`, the problem is that the setter only
	 * accepts numeric values, but the attribute can also be set to a string like `50%`.
	 * If this list becomes too big, rethink this approach.
	 */
	const always_set_through_set_attribute = ['width', 'height'];

	/**
	 * @param {Element & ElementCSSInlineStyle} node
	 * @param {{ [x: string]: string }} attributes
	 * @returns {void}
	 */
	function set_attributes(node, attributes) {
		// @ts-ignore
		const descriptors = Object.getOwnPropertyDescriptors(node.__proto__);
		for (const key in attributes) {
			if (attributes[key] == null) {
				node.removeAttribute(key);
			} else if (key === 'style') {
				node.style.cssText = attributes[key];
			} else if (key === '__value') {
				/** @type {any} */ (node).value = node[key] = attributes[key];
			} else if (
				descriptors[key] &&
				descriptors[key].set &&
				always_set_through_set_attribute.indexOf(key) === -1
			) {
				node[key] = attributes[key];
			} else {
				attr(node, key, attributes[key]);
			}
		}
	}

	/**
	 * @param {Element & ElementCSSInlineStyle} node
	 * @param {{ [x: string]: string }} attributes
	 * @returns {void}
	 */
	function set_svg_attributes(node, attributes) {
		for (const key in attributes) {
			attr(node, key, attributes[key]);
		}
	}

	/**
	 * @param {Record<string, unknown>} data_map
	 * @returns {void}
	 */
	function set_custom_element_data_map(node, data_map) {
		Object.keys(data_map).forEach((key) => {
			set_custom_element_data(node, key, data_map[key]);
		});
	}

	/**
	 * @returns {void} */
	function set_custom_element_data(node, prop, value) {
		const lower = prop.toLowerCase(); // for backwards compatibility with existing behavior we do lowercase first
		if (lower in node) {
			node[lower] = typeof node[lower] === 'boolean' && value === '' ? true : value;
		} else if (prop in node) {
			node[prop] = typeof node[prop] === 'boolean' && value === '' ? true : value;
		} else {
			attr(node, prop, value);
		}
	}

	/**
	 * @param {string} tag
	 */
	function set_dynamic_element_data(tag) {
		return /-/.test(tag) ? set_custom_element_data_map : set_attributes;
	}

	/**
	 * @param {Element} element
	 * @returns {ChildNode[]}
	 */
	function children(element) {
		return Array.from(element.childNodes);
	}

	/**
	 * @param {Text} text
	 * @param {unknown} data
	 * @returns {void}
	 */
	function set_data(text, data) {
		data = '' + data;
		if (text.data === data) return;
		text.data = /** @type {string} */ (data);
	}

	/**
	 * @returns {void} */
	function set_style(node, key, value, important) {
		if (value == null) {
			node.style.removeProperty(key);
		} else {
			node.style.setProperty(key, value, important ? 'important' : '');
		}
	}

	function construct_svelte_component(component, props) {
		return new component(props);
	}

	/**
	 * @typedef {Node & {
	 * 	claim_order?: number;
	 * 	hydrate_init?: true;
	 * 	actual_end_child?: NodeEx;
	 * 	childNodes: NodeListOf<NodeEx>;
	 * }} NodeEx
	 */

	/** @typedef {ChildNode & NodeEx} ChildNodeEx */

	/** @typedef {NodeEx & { claim_order: number }} NodeEx2 */

	/**
	 * @typedef {ChildNodeEx[] & {
	 * 	claim_info?: {
	 * 		last_index: number;
	 * 		total_claimed: number;
	 * 	};
	 * }} ChildNodeArray
	 */

	let current_component;

	/** @returns {void} */
	function set_current_component(component) {
		current_component = component;
	}

	function get_current_component() {
		if (!current_component) throw new Error('Function called outside component initialization');
		return current_component;
	}

	/**
	 * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
	 * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
	 * it can be called from an external module).
	 *
	 * If a function is returned _synchronously_ from `onMount`, it will be called when the component is unmounted.
	 *
	 * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
	 *
	 * https://svelte.dev/docs/svelte#onmount
	 * @template T
	 * @param {() => import('./private.js').NotFunction<T> | Promise<import('./private.js').NotFunction<T>> | (() => any)} fn
	 * @returns {void}
	 */
	function onMount(fn) {
		get_current_component().$$.on_mount.push(fn);
	}

	/**
	 * Schedules a callback to run immediately before the component is unmounted.
	 *
	 * Out of `onMount`, `beforeUpdate`, `afterUpdate` and `onDestroy`, this is the
	 * only one that runs inside a server-side component.
	 *
	 * https://svelte.dev/docs/svelte#ondestroy
	 * @param {() => any} fn
	 * @returns {void}
	 */
	function onDestroy(fn) {
		get_current_component().$$.on_destroy.push(fn);
	}

	/**
	 * Associates an arbitrary `context` object with the current component and the specified `key`
	 * and returns that object. The context is then available to children of the component
	 * (including slotted content) with `getContext`.
	 *
	 * Like lifecycle functions, this must be called during component initialisation.
	 *
	 * https://svelte.dev/docs/svelte#setcontext
	 * @template T
	 * @param {any} key
	 * @param {T} context
	 * @returns {T}
	 */
	function setContext(key, context) {
		get_current_component().$$.context.set(key, context);
		return context;
	}

	/**
	 * Retrieves the context that belongs to the closest parent component with the specified `key`.
	 * Must be called during component initialisation.
	 *
	 * https://svelte.dev/docs/svelte#getcontext
	 * @template T
	 * @param {any} key
	 * @returns {T}
	 */
	function getContext(key) {
		return get_current_component().$$.context.get(key);
	}

	// TODO figure out if we still want to support
	// shorthand events, or if we want to implement
	// a real bubbling mechanism
	/**
	 * @param component
	 * @param event
	 * @returns {void}
	 */
	function bubble(component, event) {
		const callbacks = component.$$.callbacks[event.type];
		if (callbacks) {
			// @ts-ignore
			callbacks.slice().forEach((fn) => fn.call(this, event));
		}
	}

	const dirty_components = [];
	const binding_callbacks = [];

	let render_callbacks = [];

	const flush_callbacks = [];

	const resolved_promise = /* @__PURE__ */ Promise.resolve();

	let update_scheduled = false;

	/** @returns {void} */
	function schedule_update() {
		if (!update_scheduled) {
			update_scheduled = true;
			resolved_promise.then(flush);
		}
	}

	/** @returns {Promise<void>} */
	function tick() {
		schedule_update();
		return resolved_promise;
	}

	/** @returns {void} */
	function add_render_callback(fn) {
		render_callbacks.push(fn);
	}

	/** @returns {void} */
	function add_flush_callback(fn) {
		flush_callbacks.push(fn);
	}

	// flush() calls callbacks in this order:
	// 1. All beforeUpdate callbacks, in order: parents before children
	// 2. All bind:this callbacks, in reverse order: children before parents.
	// 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
	//    for afterUpdates called during the initial onMount, which are called in
	//    reverse order: children before parents.
	// Since callbacks might update component values, which could trigger another
	// call to flush(), the following steps guard against this:
	// 1. During beforeUpdate, any updated components will be added to the
	//    dirty_components array and will cause a reentrant call to flush(). Because
	//    the flush index is kept outside the function, the reentrant call will pick
	//    up where the earlier call left off and go through all dirty components. The
	//    current_component value is saved and restored so that the reentrant call will
	//    not interfere with the "parent" flush() call.
	// 2. bind:this callbacks cannot trigger new flush() calls.
	// 3. During afterUpdate, any updated components will NOT have their afterUpdate
	//    callback called a second time; the seen_callbacks set, outside the flush()
	//    function, guarantees this behavior.
	const seen_callbacks = new Set();

	let flushidx = 0; // Do *not* move this inside the flush() function

	/** @returns {void} */
	function flush() {
		// Do not reenter flush while dirty components are updated, as this can
		// result in an infinite loop. Instead, let the inner flush handle it.
		// Reentrancy is ok afterwards for bindings etc.
		if (flushidx !== 0) {
			return;
		}
		const saved_component = current_component;
		do {
			// first, call beforeUpdate functions
			// and update components
			try {
				while (flushidx < dirty_components.length) {
					const component = dirty_components[flushidx];
					flushidx++;
					set_current_component(component);
					update(component.$$);
				}
			} catch (e) {
				// reset dirty state to not end up in a deadlocked state and then rethrow
				dirty_components.length = 0;
				flushidx = 0;
				throw e;
			}
			set_current_component(null);
			dirty_components.length = 0;
			flushidx = 0;
			while (binding_callbacks.length) binding_callbacks.pop()();
			// then, once components are updated, call
			// afterUpdate functions. This may cause
			// subsequent updates...
			for (let i = 0; i < render_callbacks.length; i += 1) {
				const callback = render_callbacks[i];
				if (!seen_callbacks.has(callback)) {
					// ...so guard against infinite loops
					seen_callbacks.add(callback);
					callback();
				}
			}
			render_callbacks.length = 0;
		} while (dirty_components.length);
		while (flush_callbacks.length) {
			flush_callbacks.pop()();
		}
		update_scheduled = false;
		seen_callbacks.clear();
		set_current_component(saved_component);
	}

	/** @returns {void} */
	function update($$) {
		if ($$.fragment !== null) {
			$$.update();
			run_all($$.before_update);
			const dirty = $$.dirty;
			$$.dirty = [-1];
			$$.fragment && $$.fragment.p($$.ctx, dirty);
			$$.after_update.forEach(add_render_callback);
		}
	}

	/**
	 * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
	 * @param {Function[]} fns
	 * @returns {void}
	 */
	function flush_render_callbacks(fns) {
		const filtered = [];
		const targets = [];
		render_callbacks.forEach((c) => (fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c)));
		targets.forEach((c) => c());
		render_callbacks = filtered;
	}

	const outroing = new Set();

	/**
	 * @type {Outro}
	 */
	let outros;

	/**
	 * @returns {void} */
	function group_outros() {
		outros = {
			r: 0,
			c: [],
			p: outros // parent group
		};
	}

	/**
	 * @returns {void} */
	function check_outros() {
		if (!outros.r) {
			run_all(outros.c);
		}
		outros = outros.p;
	}

	/**
	 * @param {import('./private.js').Fragment} block
	 * @param {0 | 1} [local]
	 * @returns {void}
	 */
	function transition_in(block, local) {
		if (block && block.i) {
			outroing.delete(block);
			block.i(local);
		}
	}

	/**
	 * @param {import('./private.js').Fragment} block
	 * @param {0 | 1} local
	 * @param {0 | 1} [detach]
	 * @param {() => void} [callback]
	 * @returns {void}
	 */
	function transition_out(block, local, detach, callback) {
		if (block && block.o) {
			if (outroing.has(block)) return;
			outroing.add(block);
			outros.c.push(() => {
				outroing.delete(block);
				if (callback) {
					if (detach) block.d(1);
					callback();
				}
			});
			block.o(local);
		} else if (callback) {
			callback();
		}
	}

	/** @typedef {1} INTRO */
	/** @typedef {0} OUTRO */
	/** @typedef {{ direction: 'in' | 'out' | 'both' }} TransitionOptions */
	/** @typedef {(node: Element, params: any, options: TransitionOptions) => import('../transition/public.js').TransitionConfig} TransitionFn */

	/**
	 * @typedef {Object} Outro
	 * @property {number} r
	 * @property {Function[]} c
	 * @property {Object} p
	 */

	/**
	 * @typedef {Object} PendingProgram
	 * @property {number} start
	 * @property {INTRO|OUTRO} b
	 * @property {Outro} [group]
	 */

	/**
	 * @typedef {Object} Program
	 * @property {number} a
	 * @property {INTRO|OUTRO} b
	 * @property {1|-1} d
	 * @property {number} duration
	 * @property {number} start
	 * @property {number} end
	 * @property {Outro} [group]
	 */

	/**
	 * @template T
	 * @param {Promise<T>} promise
	 * @param {import('./private.js').PromiseInfo<T>} info
	 * @returns {boolean}
	 */
	function handle_promise(promise, info) {
		const token = (info.token = {});
		/**
		 * @param {import('./private.js').FragmentFactory} type
		 * @param {0 | 1 | 2} index
		 * @param {number} [key]
		 * @param {any} [value]
		 * @returns {void}
		 */
		function update(type, index, key, value) {
			if (info.token !== token) return;
			info.resolved = value;
			let child_ctx = info.ctx;
			if (key !== undefined) {
				child_ctx = child_ctx.slice();
				child_ctx[key] = value;
			}
			const block = type && (info.current = type)(child_ctx);
			let needs_flush = false;
			if (info.block) {
				if (info.blocks) {
					info.blocks.forEach((block, i) => {
						if (i !== index && block) {
							group_outros();
							transition_out(block, 1, 1, () => {
								if (info.blocks[i] === block) {
									info.blocks[i] = null;
								}
							});
							check_outros();
						}
					});
				} else {
					info.block.d(1);
				}
				block.c();
				transition_in(block, 1);
				block.m(info.mount(), info.anchor);
				needs_flush = true;
			}
			info.block = block;
			if (info.blocks) info.blocks[index] = block;
			if (needs_flush) {
				flush();
			}
		}
		if (is_promise(promise)) {
			const current_component = get_current_component();
			promise.then(
				(value) => {
					set_current_component(current_component);
					update(info.then, 1, info.value, value);
					set_current_component(null);
				},
				(error) => {
					set_current_component(current_component);
					update(info.catch, 2, info.error, error);
					set_current_component(null);
					if (!info.hasCatch) {
						throw error;
					}
				}
			);
			// if we previously had a then/catch block, destroy it
			if (info.current !== info.pending) {
				update(info.pending, 0);
				return true;
			}
		} else {
			if (info.current !== info.then) {
				update(info.then, 1, info.value, promise);
				return true;
			}
			info.resolved = /** @type {T} */ (promise);
		}
	}

	/** @returns {void} */
	function update_await_block_branch(info, ctx, dirty) {
		const child_ctx = ctx.slice();
		const { resolved } = info;
		if (info.current === info.then) {
			child_ctx[info.value] = resolved;
		}
		if (info.current === info.catch) {
			child_ctx[info.error] = resolved;
		}
		info.block.p(child_ctx, dirty);
	}

	// general each functions:

	function ensure_array_like(array_like_or_iterator) {
		return array_like_or_iterator?.length !== undefined
			? array_like_or_iterator
			: Array.from(array_like_or_iterator);
	}

	/** @returns {void} */
	function outro_and_destroy_block(block, lookup) {
		transition_out(block, 1, 1, () => {
			lookup.delete(block.key);
		});
	}

	/** @returns {any[]} */
	function update_keyed_each(
		old_blocks,
		dirty,
		get_key,
		dynamic,
		ctx,
		list,
		lookup,
		node,
		destroy,
		create_each_block,
		next,
		get_context
	) {
		let o = old_blocks.length;
		let n = list.length;
		let i = o;
		const old_indexes = {};
		while (i--) old_indexes[old_blocks[i].key] = i;
		const new_blocks = [];
		const new_lookup = new Map();
		const deltas = new Map();
		const updates = [];
		i = n;
		while (i--) {
			const child_ctx = get_context(ctx, list, i);
			const key = get_key(child_ctx);
			let block = lookup.get(key);
			if (!block) {
				block = create_each_block(key, child_ctx);
				block.c();
			} else if (dynamic) {
				// defer updates until all the DOM shuffling is done
				updates.push(() => block.p(child_ctx, dirty));
			}
			new_lookup.set(key, (new_blocks[i] = block));
			if (key in old_indexes) deltas.set(key, Math.abs(i - old_indexes[key]));
		}
		const will_move = new Set();
		const did_move = new Set();
		/** @returns {void} */
		function insert(block) {
			transition_in(block, 1);
			block.m(node, next);
			lookup.set(block.key, block);
			next = block.first;
			n--;
		}
		while (o && n) {
			const new_block = new_blocks[n - 1];
			const old_block = old_blocks[o - 1];
			const new_key = new_block.key;
			const old_key = old_block.key;
			if (new_block === old_block) {
				// do nothing
				next = new_block.first;
				o--;
				n--;
			} else if (!new_lookup.has(old_key)) {
				// remove old block
				destroy(old_block, lookup);
				o--;
			} else if (!lookup.has(new_key) || will_move.has(new_key)) {
				insert(new_block);
			} else if (did_move.has(old_key)) {
				o--;
			} else if (deltas.get(new_key) > deltas.get(old_key)) {
				did_move.add(new_key);
				insert(new_block);
			} else {
				will_move.add(old_key);
				o--;
			}
		}
		while (o--) {
			const old_block = old_blocks[o];
			if (!new_lookup.has(old_block.key)) destroy(old_block, lookup);
		}
		while (n) insert(new_blocks[n - 1]);
		run_all(updates);
		return new_blocks;
	}

	/** @returns {{}} */
	function get_spread_update(levels, updates) {
		const update = {};
		const to_null_out = {};
		const accounted_for = { $$scope: 1 };
		let i = levels.length;
		while (i--) {
			const o = levels[i];
			const n = updates[i];
			if (n) {
				for (const key in o) {
					if (!(key in n)) to_null_out[key] = 1;
				}
				for (const key in n) {
					if (!accounted_for[key]) {
						update[key] = n[key];
						accounted_for[key] = 1;
					}
				}
				levels[i] = n;
			} else {
				for (const key in o) {
					accounted_for[key] = 1;
				}
			}
		}
		for (const key in to_null_out) {
			if (!(key in update)) update[key] = undefined;
		}
		return update;
	}

	function get_spread_object(spread_props) {
		return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
	}

	/** @returns {void} */
	function bind(component, name, callback) {
		const index = component.$$.props[name];
		if (index !== undefined) {
			component.$$.bound[index] = callback;
			callback(component.$$.ctx[index]);
		}
	}

	/** @returns {void} */
	function create_component(block) {
		block && block.c();
	}

	/** @returns {void} */
	function mount_component(component, target, anchor) {
		const { fragment, after_update } = component.$$;
		fragment && fragment.m(target, anchor);
		// onMount happens before the initial afterUpdate
		add_render_callback(() => {
			const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
			// if the component was destroyed immediately
			// it will update the `$$.on_destroy` reference to `null`.
			// the destructured on_destroy may still reference to the old array
			if (component.$$.on_destroy) {
				component.$$.on_destroy.push(...new_on_destroy);
			} else {
				// Edge case - component was destroyed immediately,
				// most likely as a result of a binding initialising
				run_all(new_on_destroy);
			}
			component.$$.on_mount = [];
		});
		after_update.forEach(add_render_callback);
	}

	/** @returns {void} */
	function destroy_component(component, detaching) {
		const $$ = component.$$;
		if ($$.fragment !== null) {
			flush_render_callbacks($$.after_update);
			run_all($$.on_destroy);
			$$.fragment && $$.fragment.d(detaching);
			// TODO null out other refs, including component.$$ (but need to
			// preserve final state?)
			$$.on_destroy = $$.fragment = null;
			$$.ctx = [];
		}
	}

	/** @returns {void} */
	function make_dirty(component, i) {
		if (component.$$.dirty[0] === -1) {
			dirty_components.push(component);
			schedule_update();
			component.$$.dirty.fill(0);
		}
		component.$$.dirty[(i / 31) | 0] |= 1 << i % 31;
	}

	// TODO: Document the other params
	/**
	 * @param {SvelteComponent} component
	 * @param {import('./public.js').ComponentConstructorOptions} options
	 *
	 * @param {import('./utils.js')['not_equal']} not_equal Used to compare props and state values.
	 * @param {(target: Element | ShadowRoot) => void} [append_styles] Function that appends styles to the DOM when the component is first initialised.
	 * This will be the `add_css` function from the compiled component.
	 *
	 * @returns {void}
	 */
	function init(
		component,
		options,
		instance,
		create_fragment,
		not_equal,
		props,
		append_styles = null,
		dirty = [-1]
	) {
		const parent_component = current_component;
		set_current_component(component);
		/** @type {import('./private.js').T$$} */
		const $$ = (component.$$ = {
			fragment: null,
			ctx: [],
			// state
			props,
			update: noop,
			not_equal,
			bound: blank_object(),
			// lifecycle
			on_mount: [],
			on_destroy: [],
			on_disconnect: [],
			before_update: [],
			after_update: [],
			context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
			// everything else
			callbacks: blank_object(),
			dirty,
			skip_bound: false,
			root: options.target || parent_component.$$.root
		});
		append_styles && append_styles($$.root);
		let ready = false;
		$$.ctx = instance
			? instance(component, options.props || {}, (i, ret, ...rest) => {
					const value = rest.length ? rest[0] : ret;
					if ($$.ctx && not_equal($$.ctx[i], ($$.ctx[i] = value))) {
						if (!$$.skip_bound && $$.bound[i]) $$.bound[i](value);
						if (ready) make_dirty(component, i);
					}
					return ret;
			  })
			: [];
		$$.update();
		ready = true;
		run_all($$.before_update);
		// `false` as a special case of no DOM component
		$$.fragment = create_fragment ? create_fragment($$.ctx) : false;
		if (options.target) {
			if (options.hydrate) {
				// TODO: what is the correct type here?
				// @ts-expect-error
				const nodes = children(options.target);
				$$.fragment && $$.fragment.l(nodes);
				nodes.forEach(detach);
			} else {
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				$$.fragment && $$.fragment.c();
			}
			if (options.intro) transition_in(component.$$.fragment);
			mount_component(component, options.target, options.anchor);
			flush();
		}
		set_current_component(parent_component);
	}

	/**
	 * Base class for Svelte components. Used when dev=false.
	 *
	 * @template {Record<string, any>} [Props=any]
	 * @template {Record<string, any>} [Events=any]
	 */
	class SvelteComponent {
		/**
		 * ### PRIVATE API
		 *
		 * Do not use, may change at any time
		 *
		 * @type {any}
		 */
		$$ = undefined;
		/**
		 * ### PRIVATE API
		 *
		 * Do not use, may change at any time
		 *
		 * @type {any}
		 */
		$$set = undefined;

		/** @returns {void} */
		$destroy() {
			destroy_component(this, 1);
			this.$destroy = noop;
		}

		/**
		 * @template {Extract<keyof Events, string>} K
		 * @param {K} type
		 * @param {((e: Events[K]) => void) | null | undefined} callback
		 * @returns {() => void}
		 */
		$on(type, callback) {
			if (!is_function(callback)) {
				return noop;
			}
			const callbacks = this.$$.callbacks[type] || (this.$$.callbacks[type] = []);
			callbacks.push(callback);
			return () => {
				const index = callbacks.indexOf(callback);
				if (index !== -1) callbacks.splice(index, 1);
			};
		}

		/**
		 * @param {Partial<Props>} props
		 * @returns {void}
		 */
		$set(props) {
			if (this.$$set && !is_empty(props)) {
				this.$$.skip_bound = true;
				this.$$set(props);
				this.$$.skip_bound = false;
			}
		}
	}

	/**
	 * @typedef {Object} CustomElementPropDefinition
	 * @property {string} [attribute]
	 * @property {boolean} [reflect]
	 * @property {'String'|'Boolean'|'Number'|'Array'|'Object'} [type]
	 */

	// generated during release, do not modify

	const PUBLIC_VERSION = '4';

	if (typeof window !== 'undefined')
		// @ts-ignore
		(window.__svelte || (window.__svelte = { v: new Set() })).v.add(PUBLIC_VERSION);

	/******************************************************************************
	Copyright (c) Microsoft Corporation.

	Permission to use, copy, modify, and/or distribute this software for any
	purpose with or without fee is hereby granted.

	THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
	REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
	AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
	INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
	LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
	OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
	PERFORMANCE OF THIS SOFTWARE.
	***************************************************************************** */
	/* global Reflect, Promise, SuppressedError, Symbol */

	var extendStatics = function(d, b) {
	  extendStatics = Object.setPrototypeOf ||
	      ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
	      function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
	  return extendStatics(d, b);
	};

	function __extends(d, b) {
	  if (typeof b !== "function" && b !== null)
	      throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
	  extendStatics(d, b);
	  function __() { this.constructor = d; }
	  d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
	}

	var __assign = function() {
	  __assign = Object.assign || function __assign(t) {
	      for (var s, i = 1, n = arguments.length; i < n; i++) {
	          s = arguments[i];
	          for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
	      }
	      return t;
	  };
	  return __assign.apply(this, arguments);
	};

	function __values(o) {
	  var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
	  if (m) return m.call(o);
	  if (o && typeof o.length === "number") return {
	      next: function () {
	          if (o && i >= o.length) o = void 0;
	          return { value: o && o[i++], done: !o };
	      }
	  };
	  throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
	}

	function __read(o, n) {
	  var m = typeof Symbol === "function" && o[Symbol.iterator];
	  if (!m) return o;
	  var i = m.call(o), r, ar = [], e;
	  try {
	      while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
	  }
	  catch (error) { e = { error: error }; }
	  finally {
	      try {
	          if (r && !r.done && (m = i["return"])) m.call(i);
	      }
	      finally { if (e) throw e.error; }
	  }
	  return ar;
	}

	function __spreadArray(to, from, pack) {
	  if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
	      if (ar || !(i in from)) {
	          if (!ar) ar = Array.prototype.slice.call(from, 0, i);
	          ar[i] = from[i];
	      }
	  }
	  return to.concat(ar || Array.prototype.slice.call(from));
	}

	typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
	  var e = new Error(message);
	  return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
	};

	/**
	 * @license
	 * Copyright 2016 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */
	var MDCFoundation = /** @class */ (function () {
	    function MDCFoundation(adapter) {
	        if (adapter === void 0) { adapter = {}; }
	        this.adapter = adapter;
	    }
	    Object.defineProperty(MDCFoundation, "cssClasses", {
	        get: function () {
	            // Classes extending MDCFoundation should implement this method to return an object which exports every
	            // CSS class the foundation class needs as a property. e.g. {ACTIVE: 'mdc-component--active'}
	            return {};
	        },
	        enumerable: false,
	        configurable: true
	    });
	    Object.defineProperty(MDCFoundation, "strings", {
	        get: function () {
	            // Classes extending MDCFoundation should implement this method to return an object which exports all
	            // semantic strings as constants. e.g. {ARIA_ROLE: 'tablist'}
	            return {};
	        },
	        enumerable: false,
	        configurable: true
	    });
	    Object.defineProperty(MDCFoundation, "numbers", {
	        get: function () {
	            // Classes extending MDCFoundation should implement this method to return an object which exports all
	            // of its semantic numbers as constants. e.g. {ANIMATION_DELAY_MS: 350}
	            return {};
	        },
	        enumerable: false,
	        configurable: true
	    });
	    Object.defineProperty(MDCFoundation, "defaultAdapter", {
	        get: function () {
	            // Classes extending MDCFoundation may choose to implement this getter in order to provide a convenient
	            // way of viewing the necessary methods of an adapter. In the future, this could also be used for adapter
	            // validation.
	            return {};
	        },
	        enumerable: false,
	        configurable: true
	    });
	    MDCFoundation.prototype.init = function () {
	        // Subclasses should override this method to perform initialization routines (registering events, etc.)
	    };
	    MDCFoundation.prototype.destroy = function () {
	        // Subclasses should override this method to perform de-initialization routines (de-registering events, etc.)
	    };
	    return MDCFoundation;
	}());

	/**
	 * @license
	 * Copyright 2016 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */
	var MDCComponent = /** @class */ (function () {
	    function MDCComponent(root, foundation) {
	        var args = [];
	        for (var _i = 2; _i < arguments.length; _i++) {
	            args[_i - 2] = arguments[_i];
	        }
	        this.root = root;
	        this.initialize.apply(this, __spreadArray([], __read(args)));
	        // Note that we initialize foundation here and not within the constructor's
	        // default param so that this.root is defined and can be used within the
	        // foundation class.
	        this.foundation =
	            foundation === undefined ? this.getDefaultFoundation() : foundation;
	        this.foundation.init();
	        this.initialSyncWithDOM();
	    }
	    MDCComponent.attachTo = function (root) {
	        // Subclasses which extend MDCBase should provide an attachTo() method that takes a root element and
	        // returns an instantiated component with its root set to that element. Also note that in the cases of
	        // subclasses, an explicit foundation class will not have to be passed in; it will simply be initialized
	        // from getDefaultFoundation().
	        return new MDCComponent(root, new MDCFoundation({}));
	    };
	    /* istanbul ignore next: method param only exists for typing purposes; it does not need to be unit tested */
	    MDCComponent.prototype.initialize = function () {
	        // Subclasses can override this to do any additional setup work that would be considered part of a
	        // "constructor". Essentially, it is a hook into the parent constructor before the foundation is
	        // initialized. Any additional arguments besides root and foundation will be passed in here.
	    };
	    MDCComponent.prototype.getDefaultFoundation = function () {
	        // Subclasses must override this method to return a properly configured foundation class for the
	        // component.
	        throw new Error('Subclasses must override getDefaultFoundation to return a properly configured ' +
	            'foundation class');
	    };
	    MDCComponent.prototype.initialSyncWithDOM = function () {
	        // Subclasses should override this method if they need to perform work to synchronize with a host DOM
	        // object. An example of this would be a form control wrapper that needs to synchronize its internal state
	        // to some property or attribute of the host DOM. Please note: this is *not* the place to perform DOM
	        // reads/writes that would cause layout / paint, as this is called synchronously from within the constructor.
	    };
	    MDCComponent.prototype.destroy = function () {
	        // Subclasses may implement this method to release any resources / deregister any listeners they have
	        // attached. An example of this might be deregistering a resize event from the window object.
	        this.foundation.destroy();
	    };
	    MDCComponent.prototype.listen = function (evtType, handler, options) {
	        this.root.addEventListener(evtType, handler, options);
	    };
	    MDCComponent.prototype.unlisten = function (evtType, handler, options) {
	        this.root.removeEventListener(evtType, handler, options);
	    };
	    /**
	     * Fires a cross-browser-compatible custom event from the component root of the given type, with the given data.
	     */
	    MDCComponent.prototype.emit = function (evtType, evtData, shouldBubble) {
	        if (shouldBubble === void 0) { shouldBubble = false; }
	        var evt;
	        if (typeof CustomEvent === 'function') {
	            evt = new CustomEvent(evtType, {
	                bubbles: shouldBubble,
	                detail: evtData,
	            });
	        }
	        else {
	            evt = document.createEvent('CustomEvent');
	            evt.initCustomEvent(evtType, shouldBubble, false, evtData);
	        }
	        this.root.dispatchEvent(evt);
	    };
	    return MDCComponent;
	}());

	/**
	 * @license
	 * Copyright 2019 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */
	/**
	 * Determine whether the current browser supports passive event listeners, and
	 * if so, use them.
	 */
	function applyPassive$1(globalObj) {
	    if (globalObj === void 0) { globalObj = window; }
	    return supportsPassiveOption(globalObj) ?
	        { passive: true } :
	        false;
	}
	function supportsPassiveOption(globalObj) {
	    if (globalObj === void 0) { globalObj = window; }
	    // See
	    // https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener
	    var passiveSupported = false;
	    try {
	        var options = {
	            // This function will be called when the browser
	            // attempts to access the passive property.
	            get passive() {
	                passiveSupported = true;
	                return false;
	            }
	        };
	        var handler = function () { };
	        globalObj.document.addEventListener('test', handler, options);
	        globalObj.document.removeEventListener('test', handler, options);
	    }
	    catch (err) {
	        passiveSupported = false;
	    }
	    return passiveSupported;
	}

	var events = /*#__PURE__*/Object.freeze({
		__proto__: null,
		applyPassive: applyPassive$1
	});

	/**
	 * @license
	 * Copyright 2018 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */
	/**
	 * @fileoverview A "ponyfill" is a polyfill that doesn't modify the global prototype chain.
	 * This makes ponyfills safer than traditional polyfills, especially for libraries like MDC.
	 */
	function closest(element, selector) {
	    if (element.closest) {
	        return element.closest(selector);
	    }
	    var el = element;
	    while (el) {
	        if (matches$1(el, selector)) {
	            return el;
	        }
	        el = el.parentElement;
	    }
	    return null;
	}
	function matches$1(element, selector) {
	    var nativeMatches = element.matches
	        || element.webkitMatchesSelector
	        || element.msMatchesSelector;
	    return nativeMatches.call(element, selector);
	}
	/**
	 * Used to compute the estimated scroll width of elements. When an element is
	 * hidden due to display: none; being applied to a parent element, the width is
	 * returned as 0. However, the element will have a true width once no longer
	 * inside a display: none context. This method computes an estimated width when
	 * the element is hidden or returns the true width when the element is visble.
	 * @param {Element} element the element whose width to estimate
	 */
	function estimateScrollWidth(element) {
	    // Check the offsetParent. If the element inherits display: none from any
	    // parent, the offsetParent property will be null (see
	    // https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/offsetParent).
	    // This check ensures we only clone the node when necessary.
	    var htmlEl = element;
	    if (htmlEl.offsetParent !== null) {
	        return htmlEl.scrollWidth;
	    }
	    var clone = htmlEl.cloneNode(true);
	    clone.style.setProperty('position', 'absolute');
	    clone.style.setProperty('transform', 'translate(-9999px, -9999px)');
	    document.documentElement.appendChild(clone);
	    var scrollWidth = clone.scrollWidth;
	    document.documentElement.removeChild(clone);
	    return scrollWidth;
	}

	var ponyfill = /*#__PURE__*/Object.freeze({
		__proto__: null,
		closest: closest,
		estimateScrollWidth: estimateScrollWidth,
		matches: matches$1
	});

	/**
	 * @license
	 * Copyright 2016 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */
	var cssClasses$8 = {
	    // Ripple is a special case where the "root" component is really a "mixin" of sorts,
	    // given that it's an 'upgrade' to an existing component. That being said it is the root
	    // CSS class that all other CSS classes derive from.
	    BG_FOCUSED: 'mdc-ripple-upgraded--background-focused',
	    FG_ACTIVATION: 'mdc-ripple-upgraded--foreground-activation',
	    FG_DEACTIVATION: 'mdc-ripple-upgraded--foreground-deactivation',
	    ROOT: 'mdc-ripple-upgraded',
	    UNBOUNDED: 'mdc-ripple-upgraded--unbounded',
	};
	var strings$a = {
	    VAR_FG_SCALE: '--mdc-ripple-fg-scale',
	    VAR_FG_SIZE: '--mdc-ripple-fg-size',
	    VAR_FG_TRANSLATE_END: '--mdc-ripple-fg-translate-end',
	    VAR_FG_TRANSLATE_START: '--mdc-ripple-fg-translate-start',
	    VAR_LEFT: '--mdc-ripple-left',
	    VAR_TOP: '--mdc-ripple-top',
	};
	var numbers$3 = {
	    DEACTIVATION_TIMEOUT_MS: 225,
	    FG_DEACTIVATION_MS: 150,
	    INITIAL_ORIGIN_SCALE: 0.6,
	    PADDING: 10,
	    TAP_DELAY_MS: 300, // Delay between touch and simulated mouse events on touch devices
	};

	/**
	 * Stores result from supportsCssVariables to avoid redundant processing to
	 * detect CSS custom variable support.
	 */
	var supportsCssVariables_;
	function supportsCssVariables(windowObj, forceRefresh) {
	    if (forceRefresh === void 0) { forceRefresh = false; }
	    var CSS = windowObj.CSS;
	    var supportsCssVars = supportsCssVariables_;
	    if (typeof supportsCssVariables_ === 'boolean' && !forceRefresh) {
	        return supportsCssVariables_;
	    }
	    var supportsFunctionPresent = CSS && typeof CSS.supports === 'function';
	    if (!supportsFunctionPresent) {
	        return false;
	    }
	    var explicitlySupportsCssVars = CSS.supports('--css-vars', 'yes');
	    // See: https://bugs.webkit.org/show_bug.cgi?id=154669
	    // See: README section on Safari
	    var weAreFeatureDetectingSafari10plus = (CSS.supports('(--css-vars: yes)') &&
	        CSS.supports('color', '#00000000'));
	    supportsCssVars =
	        explicitlySupportsCssVars || weAreFeatureDetectingSafari10plus;
	    if (!forceRefresh) {
	        supportsCssVariables_ = supportsCssVars;
	    }
	    return supportsCssVars;
	}
	function getNormalizedEventCoords(evt, pageOffset, clientRect) {
	    if (!evt) {
	        return { x: 0, y: 0 };
	    }
	    var x = pageOffset.x, y = pageOffset.y;
	    var documentX = x + clientRect.left;
	    var documentY = y + clientRect.top;
	    var normalizedX;
	    var normalizedY;
	    // Determine touch point relative to the ripple container.
	    if (evt.type === 'touchstart') {
	        var touchEvent = evt;
	        normalizedX = touchEvent.changedTouches[0].pageX - documentX;
	        normalizedY = touchEvent.changedTouches[0].pageY - documentY;
	    }
	    else {
	        var mouseEvent = evt;
	        normalizedX = mouseEvent.pageX - documentX;
	        normalizedY = mouseEvent.pageY - documentY;
	    }
	    return { x: normalizedX, y: normalizedY };
	}

	/**
	 * @license
	 * Copyright 2016 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */
	// Activation events registered on the root element of each instance for activation
	var ACTIVATION_EVENT_TYPES = [
	    'touchstart', 'pointerdown', 'mousedown', 'keydown',
	];
	// Deactivation events registered on documentElement when a pointer-related down event occurs
	var POINTER_DEACTIVATION_EVENT_TYPES = [
	    'touchend', 'pointerup', 'mouseup', 'contextmenu',
	];
	// simultaneous nested activations
	var activatedTargets = [];
	var MDCRippleFoundation = /** @class */ (function (_super) {
	    __extends(MDCRippleFoundation, _super);
	    function MDCRippleFoundation(adapter) {
	        var _this = _super.call(this, __assign(__assign({}, MDCRippleFoundation.defaultAdapter), adapter)) || this;
	        _this.activationAnimationHasEnded = false;
	        _this.activationTimer = 0;
	        _this.fgDeactivationRemovalTimer = 0;
	        _this.fgScale = '0';
	        _this.frame = { width: 0, height: 0 };
	        _this.initialSize = 0;
	        _this.layoutFrame = 0;
	        _this.maxRadius = 0;
	        _this.unboundedCoords = { left: 0, top: 0 };
	        _this.activationState = _this.defaultActivationState();
	        _this.activationTimerCallback = function () {
	            _this.activationAnimationHasEnded = true;
	            _this.runDeactivationUXLogicIfReady();
	        };
	        _this.activateHandler = function (e) {
	            _this.activateImpl(e);
	        };
	        _this.deactivateHandler = function () {
	            _this.deactivateImpl();
	        };
	        _this.focusHandler = function () {
	            _this.handleFocus();
	        };
	        _this.blurHandler = function () {
	            _this.handleBlur();
	        };
	        _this.resizeHandler = function () {
	            _this.layout();
	        };
	        return _this;
	    }
	    Object.defineProperty(MDCRippleFoundation, "cssClasses", {
	        get: function () {
	            return cssClasses$8;
	        },
	        enumerable: false,
	        configurable: true
	    });
	    Object.defineProperty(MDCRippleFoundation, "strings", {
	        get: function () {
	            return strings$a;
	        },
	        enumerable: false,
	        configurable: true
	    });
	    Object.defineProperty(MDCRippleFoundation, "numbers", {
	        get: function () {
	            return numbers$3;
	        },
	        enumerable: false,
	        configurable: true
	    });
	    Object.defineProperty(MDCRippleFoundation, "defaultAdapter", {
	        get: function () {
	            return {
	                addClass: function () { return undefined; },
	                browserSupportsCssVars: function () { return true; },
	                computeBoundingRect: function () {
	                    return ({ top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0 });
	                },
	                containsEventTarget: function () { return true; },
	                deregisterDocumentInteractionHandler: function () { return undefined; },
	                deregisterInteractionHandler: function () { return undefined; },
	                deregisterResizeHandler: function () { return undefined; },
	                getWindowPageOffset: function () { return ({ x: 0, y: 0 }); },
	                isSurfaceActive: function () { return true; },
	                isSurfaceDisabled: function () { return true; },
	                isUnbounded: function () { return true; },
	                registerDocumentInteractionHandler: function () { return undefined; },
	                registerInteractionHandler: function () { return undefined; },
	                registerResizeHandler: function () { return undefined; },
	                removeClass: function () { return undefined; },
	                updateCssVariable: function () { return undefined; },
	            };
	        },
	        enumerable: false,
	        configurable: true
	    });
	    MDCRippleFoundation.prototype.init = function () {
	        var _this = this;
	        var supportsPressRipple = this.supportsPressRipple();
	        this.registerRootHandlers(supportsPressRipple);
	        if (supportsPressRipple) {
	            var _a = MDCRippleFoundation.cssClasses, ROOT_1 = _a.ROOT, UNBOUNDED_1 = _a.UNBOUNDED;
	            requestAnimationFrame(function () {
	                _this.adapter.addClass(ROOT_1);
	                if (_this.adapter.isUnbounded()) {
	                    _this.adapter.addClass(UNBOUNDED_1);
	                    // Unbounded ripples need layout logic applied immediately to set coordinates for both shade and ripple
	                    _this.layoutInternal();
	                }
	            });
	        }
	    };
	    MDCRippleFoundation.prototype.destroy = function () {
	        var _this = this;
	        if (this.supportsPressRipple()) {
	            if (this.activationTimer) {
	                clearTimeout(this.activationTimer);
	                this.activationTimer = 0;
	                this.adapter.removeClass(MDCRippleFoundation.cssClasses.FG_ACTIVATION);
	            }
	            if (this.fgDeactivationRemovalTimer) {
	                clearTimeout(this.fgDeactivationRemovalTimer);
	                this.fgDeactivationRemovalTimer = 0;
	                this.adapter.removeClass(MDCRippleFoundation.cssClasses.FG_DEACTIVATION);
	            }
	            var _a = MDCRippleFoundation.cssClasses, ROOT_2 = _a.ROOT, UNBOUNDED_2 = _a.UNBOUNDED;
	            requestAnimationFrame(function () {
	                _this.adapter.removeClass(ROOT_2);
	                _this.adapter.removeClass(UNBOUNDED_2);
	                _this.removeCssVars();
	            });
	        }
	        this.deregisterRootHandlers();
	        this.deregisterDeactivationHandlers();
	    };
	    /**
	     * @param evt Optional event containing position information.
	     */
	    MDCRippleFoundation.prototype.activate = function (evt) {
	        this.activateImpl(evt);
	    };
	    MDCRippleFoundation.prototype.deactivate = function () {
	        this.deactivateImpl();
	    };
	    MDCRippleFoundation.prototype.layout = function () {
	        var _this = this;
	        if (this.layoutFrame) {
	            cancelAnimationFrame(this.layoutFrame);
	        }
	        this.layoutFrame = requestAnimationFrame(function () {
	            _this.layoutInternal();
	            _this.layoutFrame = 0;
	        });
	    };
	    MDCRippleFoundation.prototype.setUnbounded = function (unbounded) {
	        var UNBOUNDED = MDCRippleFoundation.cssClasses.UNBOUNDED;
	        if (unbounded) {
	            this.adapter.addClass(UNBOUNDED);
	        }
	        else {
	            this.adapter.removeClass(UNBOUNDED);
	        }
	    };
	    MDCRippleFoundation.prototype.handleFocus = function () {
	        var _this = this;
	        requestAnimationFrame(function () { return _this.adapter.addClass(MDCRippleFoundation.cssClasses.BG_FOCUSED); });
	    };
	    MDCRippleFoundation.prototype.handleBlur = function () {
	        var _this = this;
	        requestAnimationFrame(function () { return _this.adapter.removeClass(MDCRippleFoundation.cssClasses.BG_FOCUSED); });
	    };
	    /**
	     * We compute this property so that we are not querying information about the client
	     * until the point in time where the foundation requests it. This prevents scenarios where
	     * client-side feature-detection may happen too early, such as when components are rendered on the server
	     * and then initialized at mount time on the client.
	     */
	    MDCRippleFoundation.prototype.supportsPressRipple = function () {
	        return this.adapter.browserSupportsCssVars();
	    };
	    MDCRippleFoundation.prototype.defaultActivationState = function () {
	        return {
	            activationEvent: undefined,
	            hasDeactivationUXRun: false,
	            isActivated: false,
	            isProgrammatic: false,
	            wasActivatedByPointer: false,
	            wasElementMadeActive: false,
	        };
	    };
	    /**
	     * supportsPressRipple Passed from init to save a redundant function call
	     */
	    MDCRippleFoundation.prototype.registerRootHandlers = function (supportsPressRipple) {
	        var e_1, _a;
	        if (supportsPressRipple) {
	            try {
	                for (var ACTIVATION_EVENT_TYPES_1 = __values(ACTIVATION_EVENT_TYPES), ACTIVATION_EVENT_TYPES_1_1 = ACTIVATION_EVENT_TYPES_1.next(); !ACTIVATION_EVENT_TYPES_1_1.done; ACTIVATION_EVENT_TYPES_1_1 = ACTIVATION_EVENT_TYPES_1.next()) {
	                    var evtType = ACTIVATION_EVENT_TYPES_1_1.value;
	                    this.adapter.registerInteractionHandler(evtType, this.activateHandler);
	                }
	            }
	            catch (e_1_1) { e_1 = { error: e_1_1 }; }
	            finally {
	                try {
	                    if (ACTIVATION_EVENT_TYPES_1_1 && !ACTIVATION_EVENT_TYPES_1_1.done && (_a = ACTIVATION_EVENT_TYPES_1.return)) _a.call(ACTIVATION_EVENT_TYPES_1);
	                }
	                finally { if (e_1) throw e_1.error; }
	            }
	            if (this.adapter.isUnbounded()) {
	                this.adapter.registerResizeHandler(this.resizeHandler);
	            }
	        }
	        this.adapter.registerInteractionHandler('focus', this.focusHandler);
	        this.adapter.registerInteractionHandler('blur', this.blurHandler);
	    };
	    MDCRippleFoundation.prototype.registerDeactivationHandlers = function (evt) {
	        var e_2, _a;
	        if (evt.type === 'keydown') {
	            this.adapter.registerInteractionHandler('keyup', this.deactivateHandler);
	        }
	        else {
	            try {
	                for (var POINTER_DEACTIVATION_EVENT_TYPES_1 = __values(POINTER_DEACTIVATION_EVENT_TYPES), POINTER_DEACTIVATION_EVENT_TYPES_1_1 = POINTER_DEACTIVATION_EVENT_TYPES_1.next(); !POINTER_DEACTIVATION_EVENT_TYPES_1_1.done; POINTER_DEACTIVATION_EVENT_TYPES_1_1 = POINTER_DEACTIVATION_EVENT_TYPES_1.next()) {
	                    var evtType = POINTER_DEACTIVATION_EVENT_TYPES_1_1.value;
	                    this.adapter.registerDocumentInteractionHandler(evtType, this.deactivateHandler);
	                }
	            }
	            catch (e_2_1) { e_2 = { error: e_2_1 }; }
	            finally {
	                try {
	                    if (POINTER_DEACTIVATION_EVENT_TYPES_1_1 && !POINTER_DEACTIVATION_EVENT_TYPES_1_1.done && (_a = POINTER_DEACTIVATION_EVENT_TYPES_1.return)) _a.call(POINTER_DEACTIVATION_EVENT_TYPES_1);
	                }
	                finally { if (e_2) throw e_2.error; }
	            }
	        }
	    };
	    MDCRippleFoundation.prototype.deregisterRootHandlers = function () {
	        var e_3, _a;
	        try {
	            for (var ACTIVATION_EVENT_TYPES_2 = __values(ACTIVATION_EVENT_TYPES), ACTIVATION_EVENT_TYPES_2_1 = ACTIVATION_EVENT_TYPES_2.next(); !ACTIVATION_EVENT_TYPES_2_1.done; ACTIVATION_EVENT_TYPES_2_1 = ACTIVATION_EVENT_TYPES_2.next()) {
	                var evtType = ACTIVATION_EVENT_TYPES_2_1.value;
	                this.adapter.deregisterInteractionHandler(evtType, this.activateHandler);
	            }
	        }
	        catch (e_3_1) { e_3 = { error: e_3_1 }; }
	        finally {
	            try {
	                if (ACTIVATION_EVENT_TYPES_2_1 && !ACTIVATION_EVENT_TYPES_2_1.done && (_a = ACTIVATION_EVENT_TYPES_2.return)) _a.call(ACTIVATION_EVENT_TYPES_2);
	            }
	            finally { if (e_3) throw e_3.error; }
	        }
	        this.adapter.deregisterInteractionHandler('focus', this.focusHandler);
	        this.adapter.deregisterInteractionHandler('blur', this.blurHandler);
	        if (this.adapter.isUnbounded()) {
	            this.adapter.deregisterResizeHandler(this.resizeHandler);
	        }
	    };
	    MDCRippleFoundation.prototype.deregisterDeactivationHandlers = function () {
	        var e_4, _a;
	        this.adapter.deregisterInteractionHandler('keyup', this.deactivateHandler);
	        try {
	            for (var POINTER_DEACTIVATION_EVENT_TYPES_2 = __values(POINTER_DEACTIVATION_EVENT_TYPES), POINTER_DEACTIVATION_EVENT_TYPES_2_1 = POINTER_DEACTIVATION_EVENT_TYPES_2.next(); !POINTER_DEACTIVATION_EVENT_TYPES_2_1.done; POINTER_DEACTIVATION_EVENT_TYPES_2_1 = POINTER_DEACTIVATION_EVENT_TYPES_2.next()) {
	                var evtType = POINTER_DEACTIVATION_EVENT_TYPES_2_1.value;
	                this.adapter.deregisterDocumentInteractionHandler(evtType, this.deactivateHandler);
	            }
	        }
	        catch (e_4_1) { e_4 = { error: e_4_1 }; }
	        finally {
	            try {
	                if (POINTER_DEACTIVATION_EVENT_TYPES_2_1 && !POINTER_DEACTIVATION_EVENT_TYPES_2_1.done && (_a = POINTER_DEACTIVATION_EVENT_TYPES_2.return)) _a.call(POINTER_DEACTIVATION_EVENT_TYPES_2);
	            }
	            finally { if (e_4) throw e_4.error; }
	        }
	    };
	    MDCRippleFoundation.prototype.removeCssVars = function () {
	        var _this = this;
	        var rippleStrings = MDCRippleFoundation.strings;
	        var keys = Object.keys(rippleStrings);
	        keys.forEach(function (key) {
	            if (key.indexOf('VAR_') === 0) {
	                _this.adapter.updateCssVariable(rippleStrings[key], null);
	            }
	        });
	    };
	    MDCRippleFoundation.prototype.activateImpl = function (evt) {
	        var _this = this;
	        if (this.adapter.isSurfaceDisabled()) {
	            return;
	        }
	        var activationState = this.activationState;
	        if (activationState.isActivated) {
	            return;
	        }
	        // Avoid reacting to follow-on events fired by touch device after an already-processed user interaction
	        var previousActivationEvent = this.previousActivationEvent;
	        var isSameInteraction = previousActivationEvent && evt !== undefined && previousActivationEvent.type !== evt.type;
	        if (isSameInteraction) {
	            return;
	        }
	        activationState.isActivated = true;
	        activationState.isProgrammatic = evt === undefined;
	        activationState.activationEvent = evt;
	        activationState.wasActivatedByPointer = activationState.isProgrammatic ? false : evt !== undefined && (evt.type === 'mousedown' || evt.type === 'touchstart' || evt.type === 'pointerdown');
	        var hasActivatedChild = evt !== undefined &&
	            activatedTargets.length > 0 &&
	            activatedTargets.some(function (target) { return _this.adapter.containsEventTarget(target); });
	        if (hasActivatedChild) {
	            // Immediately reset activation state, while preserving logic that prevents touch follow-on events
	            this.resetActivationState();
	            return;
	        }
	        if (evt !== undefined) {
	            activatedTargets.push(evt.target);
	            this.registerDeactivationHandlers(evt);
	        }
	        activationState.wasElementMadeActive = this.checkElementMadeActive(evt);
	        if (activationState.wasElementMadeActive) {
	            this.animateActivation();
	        }
	        requestAnimationFrame(function () {
	            // Reset array on next frame after the current event has had a chance to bubble to prevent ancestor ripples
	            activatedTargets = [];
	            if (!activationState.wasElementMadeActive
	                && evt !== undefined
	                && (evt.key === ' ' || evt.keyCode === 32)) {
	                // If space was pressed, try again within an rAF call to detect :active, because different UAs report
	                // active states inconsistently when they're called within event handling code:
	                // - https://bugs.chromium.org/p/chromium/issues/detail?id=635971
	                // - https://bugzilla.mozilla.org/show_bug.cgi?id=1293741
	                // We try first outside rAF to support Edge, which does not exhibit this problem, but will crash if a CSS
	                // variable is set within a rAF callback for a submit button interaction (#2241).
	                activationState.wasElementMadeActive = _this.checkElementMadeActive(evt);
	                if (activationState.wasElementMadeActive) {
	                    _this.animateActivation();
	                }
	            }
	            if (!activationState.wasElementMadeActive) {
	                // Reset activation state immediately if element was not made active.
	                _this.activationState = _this.defaultActivationState();
	            }
	        });
	    };
	    MDCRippleFoundation.prototype.checkElementMadeActive = function (evt) {
	        return (evt !== undefined && evt.type === 'keydown') ?
	            this.adapter.isSurfaceActive() :
	            true;
	    };
	    MDCRippleFoundation.prototype.animateActivation = function () {
	        var _this = this;
	        var _a = MDCRippleFoundation.strings, VAR_FG_TRANSLATE_START = _a.VAR_FG_TRANSLATE_START, VAR_FG_TRANSLATE_END = _a.VAR_FG_TRANSLATE_END;
	        var _b = MDCRippleFoundation.cssClasses, FG_DEACTIVATION = _b.FG_DEACTIVATION, FG_ACTIVATION = _b.FG_ACTIVATION;
	        var DEACTIVATION_TIMEOUT_MS = MDCRippleFoundation.numbers.DEACTIVATION_TIMEOUT_MS;
	        this.layoutInternal();
	        var translateStart = '';
	        var translateEnd = '';
	        if (!this.adapter.isUnbounded()) {
	            var _c = this.getFgTranslationCoordinates(), startPoint = _c.startPoint, endPoint = _c.endPoint;
	            translateStart = startPoint.x + "px, " + startPoint.y + "px";
	            translateEnd = endPoint.x + "px, " + endPoint.y + "px";
	        }
	        this.adapter.updateCssVariable(VAR_FG_TRANSLATE_START, translateStart);
	        this.adapter.updateCssVariable(VAR_FG_TRANSLATE_END, translateEnd);
	        // Cancel any ongoing activation/deactivation animations
	        clearTimeout(this.activationTimer);
	        clearTimeout(this.fgDeactivationRemovalTimer);
	        this.rmBoundedActivationClasses();
	        this.adapter.removeClass(FG_DEACTIVATION);
	        // Force layout in order to re-trigger the animation.
	        this.adapter.computeBoundingRect();
	        this.adapter.addClass(FG_ACTIVATION);
	        this.activationTimer = setTimeout(function () {
	            _this.activationTimerCallback();
	        }, DEACTIVATION_TIMEOUT_MS);
	    };
	    MDCRippleFoundation.prototype.getFgTranslationCoordinates = function () {
	        var _a = this.activationState, activationEvent = _a.activationEvent, wasActivatedByPointer = _a.wasActivatedByPointer;
	        var startPoint;
	        if (wasActivatedByPointer) {
	            startPoint = getNormalizedEventCoords(activationEvent, this.adapter.getWindowPageOffset(), this.adapter.computeBoundingRect());
	        }
	        else {
	            startPoint = {
	                x: this.frame.width / 2,
	                y: this.frame.height / 2,
	            };
	        }
	        // Center the element around the start point.
	        startPoint = {
	            x: startPoint.x - (this.initialSize / 2),
	            y: startPoint.y - (this.initialSize / 2),
	        };
	        var endPoint = {
	            x: (this.frame.width / 2) - (this.initialSize / 2),
	            y: (this.frame.height / 2) - (this.initialSize / 2),
	        };
	        return { startPoint: startPoint, endPoint: endPoint };
	    };
	    MDCRippleFoundation.prototype.runDeactivationUXLogicIfReady = function () {
	        var _this = this;
	        // This method is called both when a pointing device is released, and when the activation animation ends.
	        // The deactivation animation should only run after both of those occur.
	        var FG_DEACTIVATION = MDCRippleFoundation.cssClasses.FG_DEACTIVATION;
	        var _a = this.activationState, hasDeactivationUXRun = _a.hasDeactivationUXRun, isActivated = _a.isActivated;
	        var activationHasEnded = hasDeactivationUXRun || !isActivated;
	        if (activationHasEnded && this.activationAnimationHasEnded) {
	            this.rmBoundedActivationClasses();
	            this.adapter.addClass(FG_DEACTIVATION);
	            this.fgDeactivationRemovalTimer = setTimeout(function () {
	                _this.adapter.removeClass(FG_DEACTIVATION);
	            }, numbers$3.FG_DEACTIVATION_MS);
	        }
	    };
	    MDCRippleFoundation.prototype.rmBoundedActivationClasses = function () {
	        var FG_ACTIVATION = MDCRippleFoundation.cssClasses.FG_ACTIVATION;
	        this.adapter.removeClass(FG_ACTIVATION);
	        this.activationAnimationHasEnded = false;
	        this.adapter.computeBoundingRect();
	    };
	    MDCRippleFoundation.prototype.resetActivationState = function () {
	        var _this = this;
	        this.previousActivationEvent = this.activationState.activationEvent;
	        this.activationState = this.defaultActivationState();
	        // Touch devices may fire additional events for the same interaction within a short time.
	        // Store the previous event until it's safe to assume that subsequent events are for new interactions.
	        setTimeout(function () { return _this.previousActivationEvent = undefined; }, MDCRippleFoundation.numbers.TAP_DELAY_MS);
	    };
	    MDCRippleFoundation.prototype.deactivateImpl = function () {
	        var _this = this;
	        var activationState = this.activationState;
	        // This can happen in scenarios such as when you have a keyup event that blurs the element.
	        if (!activationState.isActivated) {
	            return;
	        }
	        var state = __assign({}, activationState);
	        if (activationState.isProgrammatic) {
	            requestAnimationFrame(function () {
	                _this.animateDeactivation(state);
	            });
	            this.resetActivationState();
	        }
	        else {
	            this.deregisterDeactivationHandlers();
	            requestAnimationFrame(function () {
	                _this.activationState.hasDeactivationUXRun = true;
	                _this.animateDeactivation(state);
	                _this.resetActivationState();
	            });
	        }
	    };
	    MDCRippleFoundation.prototype.animateDeactivation = function (_a) {
	        var wasActivatedByPointer = _a.wasActivatedByPointer, wasElementMadeActive = _a.wasElementMadeActive;
	        if (wasActivatedByPointer || wasElementMadeActive) {
	            this.runDeactivationUXLogicIfReady();
	        }
	    };
	    MDCRippleFoundation.prototype.layoutInternal = function () {
	        var _this = this;
	        this.frame = this.adapter.computeBoundingRect();
	        var maxDim = Math.max(this.frame.height, this.frame.width);
	        // Surface diameter is treated differently for unbounded vs. bounded ripples.
	        // Unbounded ripple diameter is calculated smaller since the surface is expected to already be padded appropriately
	        // to extend the hitbox, and the ripple is expected to meet the edges of the padded hitbox (which is typically
	        // square). Bounded ripples, on the other hand, are fully expected to expand beyond the surface's longest diameter
	        // (calculated based on the diagonal plus a constant padding), and are clipped at the surface's border via
	        // `overflow: hidden`.
	        var getBoundedRadius = function () {
	            var hypotenuse = Math.sqrt(Math.pow(_this.frame.width, 2) + Math.pow(_this.frame.height, 2));
	            return hypotenuse + MDCRippleFoundation.numbers.PADDING;
	        };
	        this.maxRadius = this.adapter.isUnbounded() ? maxDim : getBoundedRadius();
	        // Ripple is sized as a fraction of the largest dimension of the surface, then scales up using a CSS scale transform
	        var initialSize = Math.floor(maxDim * MDCRippleFoundation.numbers.INITIAL_ORIGIN_SCALE);
	        // Unbounded ripple size should always be even number to equally center align.
	        if (this.adapter.isUnbounded() && initialSize % 2 !== 0) {
	            this.initialSize = initialSize - 1;
	        }
	        else {
	            this.initialSize = initialSize;
	        }
	        this.fgScale = "" + this.maxRadius / this.initialSize;
	        this.updateLayoutCssVars();
	    };
	    MDCRippleFoundation.prototype.updateLayoutCssVars = function () {
	        var _a = MDCRippleFoundation.strings, VAR_FG_SIZE = _a.VAR_FG_SIZE, VAR_LEFT = _a.VAR_LEFT, VAR_TOP = _a.VAR_TOP, VAR_FG_SCALE = _a.VAR_FG_SCALE;
	        this.adapter.updateCssVariable(VAR_FG_SIZE, this.initialSize + "px");
	        this.adapter.updateCssVariable(VAR_FG_SCALE, this.fgScale);
	        if (this.adapter.isUnbounded()) {
	            this.unboundedCoords = {
	                left: Math.round((this.frame.width / 2) - (this.initialSize / 2)),
	                top: Math.round((this.frame.height / 2) - (this.initialSize / 2)),
	            };
	            this.adapter.updateCssVariable(VAR_LEFT, this.unboundedCoords.left + "px");
	            this.adapter.updateCssVariable(VAR_TOP, this.unboundedCoords.top + "px");
	        }
	    };
	    return MDCRippleFoundation;
	}(MDCFoundation));

	/**
	 * @license
	 * Copyright 2016 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */
	var MDCRipple = /** @class */ (function (_super) {
	    __extends(MDCRipple, _super);
	    function MDCRipple() {
	        var _this = _super !== null && _super.apply(this, arguments) || this;
	        _this.disabled = false;
	        return _this;
	    }
	    MDCRipple.attachTo = function (root, opts) {
	        if (opts === void 0) { opts = {
	            isUnbounded: undefined
	        }; }
	        var ripple = new MDCRipple(root);
	        // Only override unbounded behavior if option is explicitly specified
	        if (opts.isUnbounded !== undefined) {
	            ripple.unbounded = opts.isUnbounded;
	        }
	        return ripple;
	    };
	    MDCRipple.createAdapter = function (instance) {
	        return {
	            addClass: function (className) { return instance.root.classList.add(className); },
	            browserSupportsCssVars: function () { return supportsCssVariables(window); },
	            computeBoundingRect: function () { return instance.root.getBoundingClientRect(); },
	            containsEventTarget: function (target) { return instance.root.contains(target); },
	            deregisterDocumentInteractionHandler: function (evtType, handler) {
	                return document.documentElement.removeEventListener(evtType, handler, applyPassive$1());
	            },
	            deregisterInteractionHandler: function (evtType, handler) {
	                return instance.root
	                    .removeEventListener(evtType, handler, applyPassive$1());
	            },
	            deregisterResizeHandler: function (handler) {
	                return window.removeEventListener('resize', handler);
	            },
	            getWindowPageOffset: function () {
	                return ({ x: window.pageXOffset, y: window.pageYOffset });
	            },
	            isSurfaceActive: function () { return matches$1(instance.root, ':active'); },
	            isSurfaceDisabled: function () { return Boolean(instance.disabled); },
	            isUnbounded: function () { return Boolean(instance.unbounded); },
	            registerDocumentInteractionHandler: function (evtType, handler) {
	                return document.documentElement.addEventListener(evtType, handler, applyPassive$1());
	            },
	            registerInteractionHandler: function (evtType, handler) {
	                return instance.root
	                    .addEventListener(evtType, handler, applyPassive$1());
	            },
	            registerResizeHandler: function (handler) {
	                return window.addEventListener('resize', handler);
	            },
	            removeClass: function (className) { return instance.root.classList.remove(className); },
	            updateCssVariable: function (varName, value) {
	                return instance.root.style.setProperty(varName, value);
	            },
	        };
	    };
	    Object.defineProperty(MDCRipple.prototype, "unbounded", {
	        get: function () {
	            return Boolean(this.isUnbounded);
	        },
	        set: function (unbounded) {
	            this.isUnbounded = Boolean(unbounded);
	            this.setUnbounded();
	        },
	        enumerable: false,
	        configurable: true
	    });
	    MDCRipple.prototype.activate = function () {
	        this.foundation.activate();
	    };
	    MDCRipple.prototype.deactivate = function () {
	        this.foundation.deactivate();
	    };
	    MDCRipple.prototype.layout = function () {
	        this.foundation.layout();
	    };
	    MDCRipple.prototype.getDefaultFoundation = function () {
	        return new MDCRippleFoundation(MDCRipple.createAdapter(this));
	    };
	    MDCRipple.prototype.initialSyncWithDOM = function () {
	        var root = this.root;
	        this.isUnbounded = 'mdcRippleIsUnbounded' in root.dataset;
	    };
	    /**
	     * Closure Compiler throws an access control error when directly accessing a
	     * protected or private property inside a getter/setter, like unbounded above.
	     * By accessing the protected property inside a method, we solve that problem.
	     * That's why this function exists.
	     */
	    MDCRipple.prototype.setUnbounded = function () {
	        this.foundation.setUnbounded(Boolean(this.isUnbounded));
	    };
	    return MDCRipple;
	}(MDCComponent));

	/**
	 * @license
	 * Copyright 2018 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */
	var cssClasses$7 = {
	    FIXED_CLASS: 'mdc-top-app-bar--fixed',
	    FIXED_SCROLLED_CLASS: 'mdc-top-app-bar--fixed-scrolled',
	    SHORT_CLASS: 'mdc-top-app-bar--short',
	    SHORT_COLLAPSED_CLASS: 'mdc-top-app-bar--short-collapsed',
	    SHORT_HAS_ACTION_ITEM_CLASS: 'mdc-top-app-bar--short-has-action-item',
	};
	var numbers$2 = {
	    DEBOUNCE_THROTTLE_RESIZE_TIME_MS: 100,
	    MAX_TOP_APP_BAR_HEIGHT: 128,
	};
	var strings$9 = {
	    ACTION_ITEM_SELECTOR: '.mdc-top-app-bar__action-item',
	    NAVIGATION_EVENT: 'MDCTopAppBar:nav',
	    NAVIGATION_ICON_SELECTOR: '.mdc-top-app-bar__navigation-icon',
	    ROOT_SELECTOR: '.mdc-top-app-bar',
	    TITLE_SELECTOR: '.mdc-top-app-bar__title',
	};

	/**
	 * @license
	 * Copyright 2018 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */
	var MDCTopAppBarBaseFoundation = /** @class */ (function (_super) {
	    __extends(MDCTopAppBarBaseFoundation, _super);
	    /* istanbul ignore next: optional argument is not a branch statement */
	    function MDCTopAppBarBaseFoundation(adapter) {
	        return _super.call(this, __assign(__assign({}, MDCTopAppBarBaseFoundation.defaultAdapter), adapter)) || this;
	    }
	    Object.defineProperty(MDCTopAppBarBaseFoundation, "strings", {
	        get: function () {
	            return strings$9;
	        },
	        enumerable: false,
	        configurable: true
	    });
	    Object.defineProperty(MDCTopAppBarBaseFoundation, "cssClasses", {
	        get: function () {
	            return cssClasses$7;
	        },
	        enumerable: false,
	        configurable: true
	    });
	    Object.defineProperty(MDCTopAppBarBaseFoundation, "numbers", {
	        get: function () {
	            return numbers$2;
	        },
	        enumerable: false,
	        configurable: true
	    });
	    Object.defineProperty(MDCTopAppBarBaseFoundation, "defaultAdapter", {
	        /**
	         * See {@link MDCTopAppBarAdapter} for typing information on parameters and return types.
	         */
	        get: function () {
	            // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
	            return {
	                addClass: function () { return undefined; },
	                removeClass: function () { return undefined; },
	                hasClass: function () { return false; },
	                setStyle: function () { return undefined; },
	                getTopAppBarHeight: function () { return 0; },
	                notifyNavigationIconClicked: function () { return undefined; },
	                getViewportScrollY: function () { return 0; },
	                getTotalActionItems: function () { return 0; },
	            };
	            // tslint:enable:object-literal-sort-keys
	        },
	        enumerable: false,
	        configurable: true
	    });
	    /** Other variants of TopAppBar foundation overrides this method */
	    MDCTopAppBarBaseFoundation.prototype.handleTargetScroll = function () { }; // tslint:disable-line:no-empty
	    /** Other variants of TopAppBar foundation overrides this method */
	    MDCTopAppBarBaseFoundation.prototype.handleWindowResize = function () { }; // tslint:disable-line:no-empty
	    MDCTopAppBarBaseFoundation.prototype.handleNavigationClick = function () {
	        this.adapter.notifyNavigationIconClicked();
	    };
	    return MDCTopAppBarBaseFoundation;
	}(MDCFoundation));

	/**
	 * @license
	 * Copyright 2018 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */
	var INITIAL_VALUE = 0;
	var MDCTopAppBarFoundation = /** @class */ (function (_super) {
	    __extends(MDCTopAppBarFoundation, _super);
	    /* istanbul ignore next: optional argument is not a branch statement */
	    function MDCTopAppBarFoundation(adapter) {
	        var _this = _super.call(this, adapter) || this;
	        /**
	         * Indicates if the top app bar was docked in the previous scroll handler iteration.
	         */
	        _this.wasDocked = true;
	        /**
	         * Indicates if the top app bar is docked in the fully shown position.
	         */
	        _this.isDockedShowing = true;
	        /**
	         * Variable for current scroll position of the top app bar
	         */
	        _this.currentAppBarOffsetTop = 0;
	        /**
	         * Used to prevent the top app bar from being scrolled out of view during resize events
	         */
	        _this.isCurrentlyBeingResized = false;
	        /**
	         * The timeout that's used to throttle the resize events
	         */
	        _this.resizeThrottleId = INITIAL_VALUE;
	        /**
	         * The timeout that's used to debounce toggling the isCurrentlyBeingResized
	         * variable after a resize
	         */
	        _this.resizeDebounceId = INITIAL_VALUE;
	        _this.lastScrollPosition = _this.adapter.getViewportScrollY();
	        _this.topAppBarHeight = _this.adapter.getTopAppBarHeight();
	        return _this;
	    }
	    MDCTopAppBarFoundation.prototype.destroy = function () {
	        _super.prototype.destroy.call(this);
	        this.adapter.setStyle('top', '');
	    };
	    /**
	     * Scroll handler for the default scroll behavior of the top app bar.
	     */
	    MDCTopAppBarFoundation.prototype.handleTargetScroll = function () {
	        var currentScrollPosition = Math.max(this.adapter.getViewportScrollY(), 0);
	        var diff = currentScrollPosition - this.lastScrollPosition;
	        this.lastScrollPosition = currentScrollPosition;
	        // If the window is being resized the lastScrollPosition needs to be updated
	        // but the current scroll of the top app bar should stay in the same
	        // position.
	        if (!this.isCurrentlyBeingResized) {
	            this.currentAppBarOffsetTop -= diff;
	            if (this.currentAppBarOffsetTop > 0) {
	                this.currentAppBarOffsetTop = 0;
	            }
	            else if (Math.abs(this.currentAppBarOffsetTop) > this.topAppBarHeight) {
	                this.currentAppBarOffsetTop = -this.topAppBarHeight;
	            }
	            this.moveTopAppBar();
	        }
	    };
	    /**
	     * Top app bar resize handler that throttle/debounce functions that execute updates.
	     */
	    MDCTopAppBarFoundation.prototype.handleWindowResize = function () {
	        var _this = this;
	        // Throttle resize events 10 p/s
	        if (!this.resizeThrottleId) {
	            this.resizeThrottleId = setTimeout(function () {
	                _this.resizeThrottleId = INITIAL_VALUE;
	                _this.throttledResizeHandler();
	            }, numbers$2.DEBOUNCE_THROTTLE_RESIZE_TIME_MS);
	        }
	        this.isCurrentlyBeingResized = true;
	        if (this.resizeDebounceId) {
	            clearTimeout(this.resizeDebounceId);
	        }
	        this.resizeDebounceId = setTimeout(function () {
	            _this.handleTargetScroll();
	            _this.isCurrentlyBeingResized = false;
	            _this.resizeDebounceId = INITIAL_VALUE;
	        }, numbers$2.DEBOUNCE_THROTTLE_RESIZE_TIME_MS);
	    };
	    /**
	     * Function to determine if the DOM needs to update.
	     */
	    MDCTopAppBarFoundation.prototype.checkForUpdate = function () {
	        var offscreenBoundaryTop = -this.topAppBarHeight;
	        var hasAnyPixelsOffscreen = this.currentAppBarOffsetTop < 0;
	        var hasAnyPixelsOnscreen = this.currentAppBarOffsetTop > offscreenBoundaryTop;
	        var partiallyShowing = hasAnyPixelsOffscreen && hasAnyPixelsOnscreen;
	        // If it's partially showing, it can't be docked.
	        if (partiallyShowing) {
	            this.wasDocked = false;
	        }
	        else {
	            // Not previously docked and not partially showing, it's now docked.
	            if (!this.wasDocked) {
	                this.wasDocked = true;
	                return true;
	            }
	            else if (this.isDockedShowing !== hasAnyPixelsOnscreen) {
	                this.isDockedShowing = hasAnyPixelsOnscreen;
	                return true;
	            }
	        }
	        return partiallyShowing;
	    };
	    /**
	     * Function to move the top app bar if needed.
	     */
	    MDCTopAppBarFoundation.prototype.moveTopAppBar = function () {
	        if (this.checkForUpdate()) {
	            // Once the top app bar is fully hidden we use the max potential top app bar height as our offset
	            // so the top app bar doesn't show if the window resizes and the new height > the old height.
	            var offset = this.currentAppBarOffsetTop;
	            if (Math.abs(offset) >= this.topAppBarHeight) {
	                offset = -numbers$2.MAX_TOP_APP_BAR_HEIGHT;
	            }
	            this.adapter.setStyle('top', offset + 'px');
	        }
	    };
	    /**
	     * Throttled function that updates the top app bar scrolled values if the
	     * top app bar height changes.
	     */
	    MDCTopAppBarFoundation.prototype.throttledResizeHandler = function () {
	        var currentHeight = this.adapter.getTopAppBarHeight();
	        if (this.topAppBarHeight !== currentHeight) {
	            this.wasDocked = false;
	            // Since the top app bar has a different height depending on the screen width, this
	            // will ensure that the top app bar remains in the correct location if
	            // completely hidden and a resize makes the top app bar a different height.
	            this.currentAppBarOffsetTop -= this.topAppBarHeight - currentHeight;
	            this.topAppBarHeight = currentHeight;
	        }
	        this.handleTargetScroll();
	    };
	    return MDCTopAppBarFoundation;
	}(MDCTopAppBarBaseFoundation));

	/**
	 * @license
	 * Copyright 2018 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */
	var MDCFixedTopAppBarFoundation = /** @class */ (function (_super) {
	    __extends(MDCFixedTopAppBarFoundation, _super);
	    function MDCFixedTopAppBarFoundation() {
	        var _this = _super !== null && _super.apply(this, arguments) || this;
	        /**
	         * State variable for the previous scroll iteration top app bar state
	         */
	        _this.wasScrolled = false;
	        return _this;
	    }
	    /**
	     * Scroll handler for applying/removing the modifier class on the fixed top app bar.
	     */
	    MDCFixedTopAppBarFoundation.prototype.handleTargetScroll = function () {
	        var currentScroll = this.adapter.getViewportScrollY();
	        if (currentScroll <= 0) {
	            if (this.wasScrolled) {
	                this.adapter.removeClass(cssClasses$7.FIXED_SCROLLED_CLASS);
	                this.wasScrolled = false;
	            }
	        }
	        else {
	            if (!this.wasScrolled) {
	                this.adapter.addClass(cssClasses$7.FIXED_SCROLLED_CLASS);
	                this.wasScrolled = true;
	            }
	        }
	    };
	    return MDCFixedTopAppBarFoundation;
	}(MDCTopAppBarFoundation));

	/**
	 * @license
	 * Copyright 2018 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */
	var MDCShortTopAppBarFoundation = /** @class */ (function (_super) {
	    __extends(MDCShortTopAppBarFoundation, _super);
	    /* istanbul ignore next: optional argument is not a branch statement */
	    function MDCShortTopAppBarFoundation(adapter) {
	        var _this = _super.call(this, adapter) || this;
	        _this.collapsed = false;
	        _this.isAlwaysCollapsed = false;
	        return _this;
	    }
	    Object.defineProperty(MDCShortTopAppBarFoundation.prototype, "isCollapsed", {
	        // Public visibility for backward compatibility.
	        get: function () {
	            return this.collapsed;
	        },
	        enumerable: false,
	        configurable: true
	    });
	    MDCShortTopAppBarFoundation.prototype.init = function () {
	        _super.prototype.init.call(this);
	        if (this.adapter.getTotalActionItems() > 0) {
	            this.adapter.addClass(cssClasses$7.SHORT_HAS_ACTION_ITEM_CLASS);
	        }
	        // If initialized with SHORT_COLLAPSED_CLASS, the bar should always be collapsed
	        this.setAlwaysCollapsed(this.adapter.hasClass(cssClasses$7.SHORT_COLLAPSED_CLASS));
	    };
	    /**
	     * Set if the short top app bar should always be collapsed.
	     *
	     * @param value When `true`, bar will always be collapsed. When `false`, bar may collapse or expand based on scroll.
	     */
	    MDCShortTopAppBarFoundation.prototype.setAlwaysCollapsed = function (value) {
	        this.isAlwaysCollapsed = !!value;
	        if (this.isAlwaysCollapsed) {
	            this.collapse();
	        }
	        else {
	            // let maybeCollapseBar determine if the bar should be collapsed
	            this.maybeCollapseBar();
	        }
	    };
	    MDCShortTopAppBarFoundation.prototype.getAlwaysCollapsed = function () {
	        return this.isAlwaysCollapsed;
	    };
	    /**
	     * Scroll handler for applying/removing the collapsed modifier class on the short top app bar.
	     */
	    MDCShortTopAppBarFoundation.prototype.handleTargetScroll = function () {
	        this.maybeCollapseBar();
	    };
	    MDCShortTopAppBarFoundation.prototype.maybeCollapseBar = function () {
	        if (this.isAlwaysCollapsed) {
	            return;
	        }
	        var currentScroll = this.adapter.getViewportScrollY();
	        if (currentScroll <= 0) {
	            if (this.collapsed) {
	                this.uncollapse();
	            }
	        }
	        else {
	            if (!this.collapsed) {
	                this.collapse();
	            }
	        }
	    };
	    MDCShortTopAppBarFoundation.prototype.uncollapse = function () {
	        this.adapter.removeClass(cssClasses$7.SHORT_COLLAPSED_CLASS);
	        this.collapsed = false;
	    };
	    MDCShortTopAppBarFoundation.prototype.collapse = function () {
	        this.adapter.addClass(cssClasses$7.SHORT_COLLAPSED_CLASS);
	        this.collapsed = true;
	    };
	    return MDCShortTopAppBarFoundation;
	}(MDCTopAppBarBaseFoundation));

	const subscriber_queue = [];

	/**
	 * Creates a `Readable` store that allows reading by subscription.
	 *
	 * https://svelte.dev/docs/svelte-store#readable
	 * @template T
	 * @param {T} [value] initial value
	 * @param {import('./public.js').StartStopNotifier<T>} [start]
	 * @returns {import('./public.js').Readable<T>}
	 */
	function readable(value, start) {
		return {
			subscribe: writable(value, start).subscribe
		};
	}

	/**
	 * Create a `Writable` store that allows both updating and reading by subscription.
	 *
	 * https://svelte.dev/docs/svelte-store#writable
	 * @template T
	 * @param {T} [value] initial value
	 * @param {import('./public.js').StartStopNotifier<T>} [start]
	 * @returns {import('./public.js').Writable<T>}
	 */
	function writable(value, start = noop) {
		/** @type {import('./public.js').Unsubscriber} */
		let stop;
		/** @type {Set<import('./private.js').SubscribeInvalidateTuple<T>>} */
		const subscribers = new Set();
		/** @param {T} new_value
		 * @returns {void}
		 */
		function set(new_value) {
			if (safe_not_equal(value, new_value)) {
				value = new_value;
				if (stop) {
					// store is ready
					const run_queue = !subscriber_queue.length;
					for (const subscriber of subscribers) {
						subscriber[1]();
						subscriber_queue.push(subscriber, value);
					}
					if (run_queue) {
						for (let i = 0; i < subscriber_queue.length; i += 2) {
							subscriber_queue[i][0](subscriber_queue[i + 1]);
						}
						subscriber_queue.length = 0;
					}
				}
			}
		}

		/**
		 * @param {import('./public.js').Updater<T>} fn
		 * @returns {void}
		 */
		function update(fn) {
			set(fn(value));
		}

		/**
		 * @param {import('./public.js').Subscriber<T>} run
		 * @param {import('./private.js').Invalidator<T>} [invalidate]
		 * @returns {import('./public.js').Unsubscriber}
		 */
		function subscribe(run, invalidate = noop) {
			/** @type {import('./private.js').SubscribeInvalidateTuple<T>} */
			const subscriber = [run, invalidate];
			subscribers.add(subscriber);
			if (subscribers.size === 1) {
				stop = start(set, update) || noop;
			}
			run(value);
			return () => {
				subscribers.delete(subscriber);
				if (subscribers.size === 0 && stop) {
					stop();
					stop = null;
				}
			};
		}
		return { set, update, subscribe };
	}

	/**
	 * A screen reader announcer, compatible with the announce function from
	 * @material/dom/announce.js.
	 *
	 * @param message The text to announce with the screen reader.
	 * @param options The options, including "priority" and "ownerDocument".
	 */
	function announce$1(message, options = {}) {
	    const priority = options.priority || 'polite';
	    const ownerDocument = options.ownerDocument || document;
	    const previousElements = ownerDocument.querySelectorAll('[data-smui-dom-announce]');
	    if (previousElements.length) {
	        previousElements.forEach((el) => {
	            var _a;
	            (_a = el.parentNode) === null || _a === void 0 ? void 0 : _a.removeChild(el);
	        });
	    }
	    const el = ownerDocument.createElement('div');
	    el.style.position = 'absolute';
	    el.style.top = '-9999px';
	    el.style.left = '-9999px';
	    el.style.height = '1px';
	    el.style.overflow = 'hidden';
	    el.setAttribute('aria-atomic', 'true');
	    el.setAttribute('aria-live', priority);
	    el.setAttribute('data-mdc-dom-announce', 'true');
	    el.setAttribute('data-smui-dom-announce', 'true');
	    ownerDocument.body.appendChild(el);
	    window.setTimeout(() => {
	        el.textContent = message;
	        const clear = () => {
	            el.textContent = '';
	            el.removeEventListener('click', clear);
	        };
	        el.addEventListener('click', clear, { once: true });
	    }, 100);
	}

	function classMap(classObj) {
	    return Object.entries(classObj)
	        .filter(([name, value]) => name !== '' && value)
	        .map(([name]) => name)
	        .join(' ');
	}

	function dispatch(element, eventType, detail, eventInit = { bubbles: true }, 
	/** This is an internal thing used by SMUI to duplicate some SMUI events as MDC events. */
	duplicateEventForMDC = false) {
	    if (typeof Event === 'undefined') {
	        throw new Error('Event not defined.');
	    }
	    if (!element) {
	        throw new Error('Tried to dipatch event without element.');
	    }
	    const event = new CustomEvent(eventType, Object.assign(Object.assign({}, eventInit), { detail }));
	    element === null || element === void 0 ? void 0 : element.dispatchEvent(event);
	    if (duplicateEventForMDC && eventType.startsWith('SMUI')) {
	        const duplicateEvent = new CustomEvent(eventType.replace(/^SMUI/g, () => 'MDC'), Object.assign(Object.assign({}, eventInit), { detail }));
	        element === null || element === void 0 ? void 0 : element.dispatchEvent(duplicateEvent);
	        if (duplicateEvent.defaultPrevented) {
	            event.preventDefault();
	        }
	    }
	    return event;
	}

	function exclude(obj, keys) {
	    let names = Object.getOwnPropertyNames(obj);
	    const newObj = {};
	    for (let i = 0; i < names.length; i++) {
	        const name = names[i];
	        const cashIndex = name.indexOf('$');
	        if (cashIndex !== -1 &&
	            keys.indexOf(name.substring(0, cashIndex + 1)) !== -1) {
	            continue;
	        }
	        if (keys.indexOf(name) !== -1) {
	            continue;
	        }
	        newObj[name] = obj[name];
	    }
	    return newObj;
	}

	// Match old modifiers. (only works on DOM events)
	const oldModifierRegex = /^[a-z]+(?::(?:preventDefault|stopPropagation|passive|nonpassive|capture|once|self))+$/;
	// Match new modifiers.
	const newModifierRegex = /^[^$]+(?:\$(?:preventDefault|stopPropagation|passive|nonpassive|capture|once|self))+$/;
	function forwardEventsBuilder(component) {
	    // This is our pseudo $on function. It is defined on component mount.
	    let $on;
	    // This is a list of events bound before mount.
	    let events = [];
	    // And we override the $on function to forward all bound events.
	    component.$on = (fullEventType, callback) => {
	        let eventType = fullEventType;
	        let destructor = () => { };
	        if ($on) {
	            // The event was bound programmatically.
	            destructor = $on(eventType, callback);
	        }
	        else {
	            // The event was bound before mount by Svelte.
	            events.push([eventType, callback]);
	        }
	        const oldModifierMatch = eventType.match(oldModifierRegex);
	        if (oldModifierMatch && console) {
	            console.warn('Event modifiers in SMUI now use "$" instead of ":", so that ' +
	                'all events can be bound with modifiers. Please update your ' +
	                'event binding: ', eventType);
	        }
	        return () => {
	            destructor();
	        };
	    };
	    function bubble(e) {
	        // Internally bubble the event up from Svelte components.
	        const callbacks = component.$$.callbacks[e.type];
	        if (callbacks) {
	            // @ts-ignore
	            callbacks.slice().forEach((fn) => fn.call(this, e));
	        }
	    }
	    return (node) => {
	        const destructors = [];
	        const forwardDestructors = {};
	        // This function is responsible for listening and forwarding
	        // all bound events.
	        $on = (fullEventType, callback) => {
	            let eventType = fullEventType;
	            let handler = callback;
	            // DOM addEventListener options argument.
	            let options = false;
	            const oldModifierMatch = eventType.match(oldModifierRegex);
	            const newModifierMatch = eventType.match(newModifierRegex);
	            const modifierMatch = oldModifierMatch || newModifierMatch;
	            if (eventType.match(/^SMUI:\w+:/)) {
	                const newEventTypeParts = eventType.split(':');
	                let newEventType = '';
	                for (let i = 0; i < newEventTypeParts.length; i++) {
	                    newEventType +=
	                        i === newEventTypeParts.length - 1
	                            ? ':' + newEventTypeParts[i]
	                            : newEventTypeParts[i]
	                                .split('-')
	                                .map((value) => value.slice(0, 1).toUpperCase() + value.slice(1))
	                                .join('');
	                }
	                console.warn(`The event ${eventType.split('$')[0]} has been renamed to ${newEventType.split('$')[0]}.`);
	                eventType = newEventType;
	            }
	            if (modifierMatch) {
	                // Parse the event modifiers.
	                // Supported modifiers:
	                // - preventDefault
	                // - stopPropagation
	                // - stopImmediatePropagation
	                // - passive
	                // - nonpassive
	                // - capture
	                // - once
	                // - self
	                // - trusted
	                const parts = eventType.split(oldModifierMatch ? ':' : '$');
	                eventType = parts[0];
	                const eventOptions = parts.slice(1).reduce((obj, mod) => {
	                    obj[mod] = true;
	                    return obj;
	                }, {});
	                if (eventOptions.passive) {
	                    options = options || {};
	                    options.passive = true;
	                }
	                if (eventOptions.nonpassive) {
	                    options = options || {};
	                    options.passive = false;
	                }
	                if (eventOptions.capture) {
	                    options = options || {};
	                    options.capture = true;
	                }
	                if (eventOptions.once) {
	                    options = options || {};
	                    options.once = true;
	                }
	                if (eventOptions.preventDefault) {
	                    handler = prevent_default(handler);
	                }
	                if (eventOptions.stopPropagation) {
	                    handler = stop_propagation(handler);
	                }
	                if (eventOptions.stopImmediatePropagation) {
	                    handler = stop_immediate_propagation(handler);
	                }
	                if (eventOptions.self) {
	                    handler = self_event(node, handler);
	                }
	                if (eventOptions.trusted) {
	                    handler = trusted_event(handler);
	                }
	            }
	            // Listen for the event directly, with the given options.
	            const off = listen(node, eventType, handler, options);
	            const destructor = () => {
	                off();
	                const idx = destructors.indexOf(destructor);
	                if (idx > -1) {
	                    destructors.splice(idx, 1);
	                }
	            };
	            destructors.push(destructor);
	            // Forward the event from Svelte.
	            if (!(eventType in forwardDestructors)) {
	                forwardDestructors[eventType] = listen(node, eventType, bubble);
	            }
	            return destructor;
	        };
	        for (let i = 0; i < events.length; i++) {
	            // Listen to all the events added before mount.
	            $on(events[i][0], events[i][1]);
	        }
	        return {
	            destroy: () => {
	                // Remove all event listeners.
	                for (let i = 0; i < destructors.length; i++) {
	                    destructors[i]();
	                }
	                // Remove all event forwarders.
	                for (let entry of Object.entries(forwardDestructors)) {
	                    entry[1]();
	                }
	            },
	        };
	    };
	}
	function listen(node, event, handler, options) {
	    node.addEventListener(event, handler, options);
	    return () => node.removeEventListener(event, handler, options);
	}
	function prevent_default(fn) {
	    return function (event) {
	        event.preventDefault();
	        // @ts-ignore
	        return fn.call(this, event);
	    };
	}
	function stop_propagation(fn) {
	    return function (event) {
	        event.stopPropagation();
	        // @ts-ignore
	        return fn.call(this, event);
	    };
	}
	function stop_immediate_propagation(fn) {
	    return function (event) {
	        event.stopImmediatePropagation();
	        // @ts-ignore
	        return fn.call(this, event);
	    };
	}
	function self_event(node, fn) {
	    return function (event) {
	        if (event.target !== node) {
	            return;
	        }
	        // @ts-ignore
	        return fn.call(this, event);
	    };
	}
	function trusted_event(fn) {
	    return function (event) {
	        if (!event.isTrusted) {
	            return;
	        }
	        // @ts-ignore
	        return fn.call(this, event);
	    };
	}

	function prefixFilter(obj, prefix) {
	    let names = Object.getOwnPropertyNames(obj);
	    const newObj = {};
	    for (let i = 0; i < names.length; i++) {
	        const name = names[i];
	        if (name.substring(0, prefix.length) === prefix) {
	            newObj[name.substring(prefix.length)] = obj[name];
	        }
	    }
	    return newObj;
	}

	function useActions(node, actions) {
	    let actionReturns = [];
	    if (actions) {
	        for (let i = 0; i < actions.length; i++) {
	            const actionEntry = actions[i];
	            const action = Array.isArray(actionEntry) ? actionEntry[0] : actionEntry;
	            if (Array.isArray(actionEntry) && actionEntry.length > 1) {
	                actionReturns.push(action(node, actionEntry[1]));
	            }
	            else {
	                actionReturns.push(action(node));
	            }
	        }
	    }
	    return {
	        update(actions) {
	            if (((actions && actions.length) || 0) != actionReturns.length) {
	                throw new Error('You must not change the length of an actions array.');
	            }
	            if (actions) {
	                for (let i = 0; i < actions.length; i++) {
	                    const returnEntry = actionReturns[i];
	                    if (returnEntry && returnEntry.update) {
	                        const actionEntry = actions[i];
	                        if (Array.isArray(actionEntry) && actionEntry.length > 1) {
	                            returnEntry.update(actionEntry[1]);
	                        }
	                        else {
	                            returnEntry.update();
	                        }
	                    }
	                }
	            }
	        },
	        destroy() {
	            for (let i = 0; i < actionReturns.length; i++) {
	                const returnEntry = actionReturns[i];
	                if (returnEntry && returnEntry.destroy) {
	                    returnEntry.destroy();
	                }
	            }
	        },
	    };
	}

	/* node_modules/@smui/top-app-bar/dist/TopAppBar.svelte generated by Svelte v4.2.7 */

	const { window: window_1 } = globals;

	function create_fragment$k(ctx) {
		let header;
		let header_class_value;
		let header_style_value;
		let useActions_action;
		let current;
		let mounted;
		let dispose;
		const default_slot_template = /*#slots*/ ctx[22].default;
		const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[21], null);

		let header_levels = [
			{
				class: header_class_value = classMap({
					[/*className*/ ctx[2]]: true,
					'mdc-top-app-bar': true,
					'mdc-top-app-bar--short': /*variant*/ ctx[4] === 'short',
					'mdc-top-app-bar--short-collapsed': /*collapsed*/ ctx[0],
					'mdc-top-app-bar--fixed': /*variant*/ ctx[4] === 'fixed',
					'smui-top-app-bar--static': /*variant*/ ctx[4] === 'static',
					'smui-top-app-bar--color-secondary': /*color*/ ctx[5] === 'secondary',
					'mdc-top-app-bar--prominent': /*prominent*/ ctx[6],
					'mdc-top-app-bar--dense': /*dense*/ ctx[7],
					.../*internalClasses*/ ctx[11]
				})
			},
			{
				style: header_style_value = Object.entries(/*internalStyles*/ ctx[12]).map(func$6).concat([/*style*/ ctx[3]]).join(' ')
			},
			/*$$restProps*/ ctx[15]
		];

		let header_data = {};

		for (let i = 0; i < header_levels.length; i += 1) {
			header_data = assign(header_data, header_levels[i]);
		}

		return {
			c() {
				header = element("header");
				if (default_slot) default_slot.c();
				set_attributes(header, header_data);
			},
			m(target, anchor) {
				insert(target, header, anchor);

				if (default_slot) {
					default_slot.m(header, null);
				}

				/*header_binding*/ ctx[25](header);
				current = true;

				if (!mounted) {
					dispose = [
						listen$1(window_1, "resize", /*resize_handler*/ ctx[23]),
						listen$1(window_1, "scroll", /*scroll_handler*/ ctx[24]),
						action_destroyer(useActions_action = useActions.call(null, header, /*use*/ ctx[1])),
						action_destroyer(/*forwardEvents*/ ctx[13].call(null, header)),
						listen$1(header, "SMUITopAppBarIconButton:nav", /*SMUITopAppBarIconButton_nav_handler*/ ctx[26])
					];

					mounted = true;
				}
			},
			p(ctx, dirty) {
				if (default_slot) {
					if (default_slot.p && (!current || dirty[0] & /*$$scope*/ 2097152)) {
						update_slot_base(
							default_slot,
							default_slot_template,
							ctx,
							/*$$scope*/ ctx[21],
							!current
							? get_all_dirty_from_scope(/*$$scope*/ ctx[21])
							: get_slot_changes(default_slot_template, /*$$scope*/ ctx[21], dirty, null),
							null
						);
					}
				}

				set_attributes(header, header_data = get_spread_update(header_levels, [
					(!current || dirty[0] & /*className, variant, collapsed, color, prominent, dense, internalClasses*/ 2293 && header_class_value !== (header_class_value = classMap({
						[/*className*/ ctx[2]]: true,
						'mdc-top-app-bar': true,
						'mdc-top-app-bar--short': /*variant*/ ctx[4] === 'short',
						'mdc-top-app-bar--short-collapsed': /*collapsed*/ ctx[0],
						'mdc-top-app-bar--fixed': /*variant*/ ctx[4] === 'fixed',
						'smui-top-app-bar--static': /*variant*/ ctx[4] === 'static',
						'smui-top-app-bar--color-secondary': /*color*/ ctx[5] === 'secondary',
						'mdc-top-app-bar--prominent': /*prominent*/ ctx[6],
						'mdc-top-app-bar--dense': /*dense*/ ctx[7],
						.../*internalClasses*/ ctx[11]
					}))) && { class: header_class_value },
					(!current || dirty[0] & /*internalStyles, style*/ 4104 && header_style_value !== (header_style_value = Object.entries(/*internalStyles*/ ctx[12]).map(func$6).concat([/*style*/ ctx[3]]).join(' '))) && { style: header_style_value },
					dirty[0] & /*$$restProps*/ 32768 && /*$$restProps*/ ctx[15]
				]));

				if (useActions_action && is_function(useActions_action.update) && dirty[0] & /*use*/ 2) useActions_action.update.call(null, /*use*/ ctx[1]);
			},
			i(local) {
				if (current) return;
				transition_in(default_slot, local);
				current = true;
			},
			o(local) {
				transition_out(default_slot, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(header);
				}

				if (default_slot) default_slot.d(detaching);
				/*header_binding*/ ctx[25](null);
				mounted = false;
				run_all(dispose);
			}
		};
	}

	const func$6 = ([name, value]) => `${name}: ${value};`;

	function instance_1$8($$self, $$props, $$invalidate) {
		const omit_props_names = [
			"use","class","style","variant","color","collapsed","prominent","dense","scrollTarget","getPropStore","getElement"
		];

		let $$restProps = compute_rest_props($$props, omit_props_names);
		let { $$slots: slots = {}, $$scope } = $$props;
		const forwardEvents = forwardEventsBuilder(get_current_component());

		let uninitializedValue = () => {
			
		};

		function isUninitializedValue(value) {
			return value === uninitializedValue;
		}

		let { use = [] } = $$props;
		let { class: className = '' } = $$props;
		let { style = '' } = $$props;
		let { variant = 'standard' } = $$props;
		let { color = 'primary' } = $$props;
		let { collapsed = uninitializedValue } = $$props;
		const alwaysCollapsed = !isUninitializedValue(collapsed) && !!collapsed;

		if (isUninitializedValue(collapsed)) {
			collapsed = false;
		}

		let { prominent = false } = $$props;
		let { dense = false } = $$props;
		let { scrollTarget = undefined } = $$props;
		let element;
		let instance;
		let internalClasses = {};
		let internalStyles = {};
		let propStoreSet;

		let propStore = readable({ variant, prominent, dense }, set => {
			$$invalidate(18, propStoreSet = set);
		});

		let oldScrollTarget = undefined;
		let oldVariant = variant;

		onMount(() => {
			$$invalidate(9, instance = getInstance());
			instance.init();

			return () => {
				instance.destroy();
			};
		});

		function getInstance() {
			const Foundation = ({
				static: MDCTopAppBarBaseFoundation,
				short: MDCShortTopAppBarFoundation,
				fixed: MDCFixedTopAppBarFoundation,
				standard: MDCTopAppBarFoundation
			})[variant] || MDCTopAppBarFoundation;

			return new Foundation({
					hasClass,
					addClass,
					removeClass,
					setStyle: addStyle,
					getTopAppBarHeight: () => element.clientHeight,
					notifyNavigationIconClicked: () => dispatch(element, 'SMUITopAppBar:nav', undefined, undefined, true),
					getViewportScrollY: () => scrollTarget == null
					? window.pageYOffset
					: scrollTarget.scrollTop,
					getTotalActionItems: () => element.querySelectorAll('.mdc-top-app-bar__action-item').length
				});
		}

		function hasClass(className) {
			return className in internalClasses
			? internalClasses[className]
			: getElement().classList.contains(className);
		}

		function addClass(className) {
			if (!internalClasses[className]) {
				$$invalidate(11, internalClasses[className] = true, internalClasses);
			}
		}

		function removeClass(className) {
			if (!(className in internalClasses) || internalClasses[className]) {
				$$invalidate(11, internalClasses[className] = false, internalClasses);
			}
		}

		function addStyle(name, value) {
			if (internalStyles[name] != value) {
				if (value === '' || value == null) {
					delete internalStyles[name];
					((($$invalidate(12, internalStyles), $$invalidate(20, oldVariant)), $$invalidate(4, variant)), $$invalidate(9, instance));
				} else {
					$$invalidate(12, internalStyles[name] = value, internalStyles);
				}
			}
		}

		function handleTargetScroll() {
			if (instance) {
				instance.handleTargetScroll();

				if (variant === 'short') {
					$$invalidate(0, collapsed = 'isCollapsed' in instance && instance.isCollapsed);
				}
			}
		}

		function getPropStore() {
			return propStore;
		}

		function getElement() {
			return element;
		}

		const resize_handler = () => variant !== 'short' && variant !== 'fixed' && instance && instance.handleWindowResize();
		const scroll_handler = () => scrollTarget == null && handleTargetScroll();

		function header_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				element = $$value;
				$$invalidate(10, element);
			});
		}

		const SMUITopAppBarIconButton_nav_handler = () => instance && instance.handleNavigationClick();

		$$self.$$set = $$new_props => {
			$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
			$$invalidate(15, $$restProps = compute_rest_props($$props, omit_props_names));
			if ('use' in $$new_props) $$invalidate(1, use = $$new_props.use);
			if ('class' in $$new_props) $$invalidate(2, className = $$new_props.class);
			if ('style' in $$new_props) $$invalidate(3, style = $$new_props.style);
			if ('variant' in $$new_props) $$invalidate(4, variant = $$new_props.variant);
			if ('color' in $$new_props) $$invalidate(5, color = $$new_props.color);
			if ('collapsed' in $$new_props) $$invalidate(0, collapsed = $$new_props.collapsed);
			if ('prominent' in $$new_props) $$invalidate(6, prominent = $$new_props.prominent);
			if ('dense' in $$new_props) $$invalidate(7, dense = $$new_props.dense);
			if ('scrollTarget' in $$new_props) $$invalidate(8, scrollTarget = $$new_props.scrollTarget);
			if ('$$scope' in $$new_props) $$invalidate(21, $$scope = $$new_props.$$scope);
		};

		$$self.$$.update = () => {
			if ($$self.$$.dirty[0] & /*propStoreSet, variant, prominent, dense*/ 262352) {
				if (propStoreSet) {
					propStoreSet({ variant, prominent, dense });
				}
			}

			if ($$self.$$.dirty[0] & /*oldVariant, variant, instance*/ 1049104) {
				if (oldVariant !== variant && instance) {
					$$invalidate(20, oldVariant = variant);
					instance.destroy();
					$$invalidate(11, internalClasses = {});
					$$invalidate(12, internalStyles = {});
					$$invalidate(9, instance = getInstance());
					instance.init();
				}
			}

			if ($$self.$$.dirty[0] & /*instance, variant*/ 528) {
				if (instance && variant === 'short' && 'setAlwaysCollapsed' in instance) {
					instance.setAlwaysCollapsed(alwaysCollapsed);
				}
			}

			if ($$self.$$.dirty[0] & /*oldScrollTarget, scrollTarget*/ 524544) {
				if (oldScrollTarget !== scrollTarget) {
					if (oldScrollTarget) {
						oldScrollTarget.removeEventListener('scroll', handleTargetScroll);
					}

					if (scrollTarget) {
						scrollTarget.addEventListener('scroll', handleTargetScroll);
					}

					$$invalidate(19, oldScrollTarget = scrollTarget);
				}
			}
		};

		return [
			collapsed,
			use,
			className,
			style,
			variant,
			color,
			prominent,
			dense,
			scrollTarget,
			instance,
			element,
			internalClasses,
			internalStyles,
			forwardEvents,
			handleTargetScroll,
			$$restProps,
			getPropStore,
			getElement,
			propStoreSet,
			oldScrollTarget,
			oldVariant,
			$$scope,
			slots,
			resize_handler,
			scroll_handler,
			header_binding,
			SMUITopAppBarIconButton_nav_handler
		];
	}

	class TopAppBar extends SvelteComponent {
		constructor(options) {
			super();

			init(
				this,
				options,
				instance_1$8,
				create_fragment$k,
				safe_not_equal,
				{
					use: 1,
					class: 2,
					style: 3,
					variant: 4,
					color: 5,
					collapsed: 0,
					prominent: 6,
					dense: 7,
					scrollTarget: 8,
					getPropStore: 16,
					getElement: 17
				},
				null,
				[-1, -1]
			);
		}

		get getPropStore() {
			return this.$$.ctx[16];
		}

		get getElement() {
			return this.$$.ctx[17];
		}
	}

	/* node_modules/@smui/common/dist/CommonLabel.svelte generated by Svelte v4.2.7 */

	function create_default_slot$8(ctx) {
		let current;
		const default_slot_template = /*#slots*/ ctx[10].default;
		const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[12], null);

		return {
			c() {
				if (default_slot) default_slot.c();
			},
			m(target, anchor) {
				if (default_slot) {
					default_slot.m(target, anchor);
				}

				current = true;
			},
			p(ctx, dirty) {
				if (default_slot) {
					if (default_slot.p && (!current || dirty & /*$$scope*/ 4096)) {
						update_slot_base(
							default_slot,
							default_slot_template,
							ctx,
							/*$$scope*/ ctx[12],
							!current
							? get_all_dirty_from_scope(/*$$scope*/ ctx[12])
							: get_slot_changes(default_slot_template, /*$$scope*/ ctx[12], dirty, null),
							null
						);
					}
				}
			},
			i(local) {
				if (current) return;
				transition_in(default_slot, local);
				current = true;
			},
			o(local) {
				transition_out(default_slot, local);
				current = false;
			},
			d(detaching) {
				if (default_slot) default_slot.d(detaching);
			}
		};
	}

	function create_fragment$j(ctx) {
		let switch_instance;
		let switch_instance_anchor;
		let current;

		const switch_instance_spread_levels = [
			{ tag: /*tag*/ ctx[3] },
			{
				use: [/*forwardEvents*/ ctx[5], .../*use*/ ctx[0]]
			},
			{
				class: classMap({
					[/*className*/ ctx[1]]: true,
					'mdc-button__label': /*context*/ ctx[6] === 'button',
					'mdc-fab__label': /*context*/ ctx[6] === 'fab',
					'mdc-tab__text-label': /*context*/ ctx[6] === 'tab',
					'mdc-image-list__label': /*context*/ ctx[6] === 'image-list',
					'mdc-snackbar__label': /*context*/ ctx[6] === 'snackbar',
					'mdc-banner__text': /*context*/ ctx[6] === 'banner',
					'mdc-segmented-button__label': /*context*/ ctx[6] === 'segmented-button',
					'mdc-data-table__pagination-rows-per-page-label': /*context*/ ctx[6] === 'data-table:pagination',
					'mdc-data-table__header-cell-label': /*context*/ ctx[6] === 'data-table:sortable-header-cell'
				})
			},
			/*context*/ ctx[6] === 'snackbar'
			? { 'aria-atomic': 'false' }
			: {},
			{ tabindex: /*tabindex*/ ctx[7] },
			/*$$restProps*/ ctx[8]
		];

		var switch_value = /*component*/ ctx[2];

		function switch_props(ctx, dirty) {
			let switch_instance_props = {
				$$slots: { default: [create_default_slot$8] },
				$$scope: { ctx }
			};

			if (dirty !== undefined && dirty & /*tag, forwardEvents, use, className, context, tabindex, $$restProps*/ 491) {
				switch_instance_props = get_spread_update(switch_instance_spread_levels, [
					dirty & /*tag*/ 8 && { tag: /*tag*/ ctx[3] },
					dirty & /*forwardEvents, use*/ 33 && {
						use: [/*forwardEvents*/ ctx[5], .../*use*/ ctx[0]]
					},
					dirty & /*className, context*/ 66 && {
						class: classMap({
							[/*className*/ ctx[1]]: true,
							'mdc-button__label': /*context*/ ctx[6] === 'button',
							'mdc-fab__label': /*context*/ ctx[6] === 'fab',
							'mdc-tab__text-label': /*context*/ ctx[6] === 'tab',
							'mdc-image-list__label': /*context*/ ctx[6] === 'image-list',
							'mdc-snackbar__label': /*context*/ ctx[6] === 'snackbar',
							'mdc-banner__text': /*context*/ ctx[6] === 'banner',
							'mdc-segmented-button__label': /*context*/ ctx[6] === 'segmented-button',
							'mdc-data-table__pagination-rows-per-page-label': /*context*/ ctx[6] === 'data-table:pagination',
							'mdc-data-table__header-cell-label': /*context*/ ctx[6] === 'data-table:sortable-header-cell'
						})
					},
					dirty & /*context*/ 64 && get_spread_object(/*context*/ ctx[6] === 'snackbar'
					? { 'aria-atomic': 'false' }
					: {}),
					dirty & /*tabindex*/ 128 && { tabindex: /*tabindex*/ ctx[7] },
					dirty & /*$$restProps*/ 256 && get_spread_object(/*$$restProps*/ ctx[8])
				]);
			} else {
				for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
					switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
				}
			}

			return { props: switch_instance_props };
		}

		if (switch_value) {
			switch_instance = construct_svelte_component(switch_value, switch_props(ctx));
			/*switch_instance_binding*/ ctx[11](switch_instance);
		}

		return {
			c() {
				if (switch_instance) create_component(switch_instance.$$.fragment);
				switch_instance_anchor = empty();
			},
			m(target, anchor) {
				if (switch_instance) mount_component(switch_instance, target, anchor);
				insert(target, switch_instance_anchor, anchor);
				current = true;
			},
			p(ctx, [dirty]) {
				if (dirty & /*component*/ 4 && switch_value !== (switch_value = /*component*/ ctx[2])) {
					if (switch_instance) {
						group_outros();
						const old_component = switch_instance;

						transition_out(old_component.$$.fragment, 1, 0, () => {
							destroy_component(old_component, 1);
						});

						check_outros();
					}

					if (switch_value) {
						switch_instance = construct_svelte_component(switch_value, switch_props(ctx, dirty));
						/*switch_instance_binding*/ ctx[11](switch_instance);
						create_component(switch_instance.$$.fragment);
						transition_in(switch_instance.$$.fragment, 1);
						mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
					} else {
						switch_instance = null;
					}
				} else if (switch_value) {
					const switch_instance_changes = (dirty & /*tag, forwardEvents, use, className, context, tabindex, $$restProps*/ 491)
					? get_spread_update(switch_instance_spread_levels, [
							dirty & /*tag*/ 8 && { tag: /*tag*/ ctx[3] },
							dirty & /*forwardEvents, use*/ 33 && {
								use: [/*forwardEvents*/ ctx[5], .../*use*/ ctx[0]]
							},
							dirty & /*className, context*/ 66 && {
								class: classMap({
									[/*className*/ ctx[1]]: true,
									'mdc-button__label': /*context*/ ctx[6] === 'button',
									'mdc-fab__label': /*context*/ ctx[6] === 'fab',
									'mdc-tab__text-label': /*context*/ ctx[6] === 'tab',
									'mdc-image-list__label': /*context*/ ctx[6] === 'image-list',
									'mdc-snackbar__label': /*context*/ ctx[6] === 'snackbar',
									'mdc-banner__text': /*context*/ ctx[6] === 'banner',
									'mdc-segmented-button__label': /*context*/ ctx[6] === 'segmented-button',
									'mdc-data-table__pagination-rows-per-page-label': /*context*/ ctx[6] === 'data-table:pagination',
									'mdc-data-table__header-cell-label': /*context*/ ctx[6] === 'data-table:sortable-header-cell'
								})
							},
							dirty & /*context*/ 64 && get_spread_object(/*context*/ ctx[6] === 'snackbar'
							? { 'aria-atomic': 'false' }
							: {}),
							dirty & /*tabindex*/ 128 && { tabindex: /*tabindex*/ ctx[7] },
							dirty & /*$$restProps*/ 256 && get_spread_object(/*$$restProps*/ ctx[8])
						])
					: {};

					if (dirty & /*$$scope*/ 4096) {
						switch_instance_changes.$$scope = { dirty, ctx };
					}

					switch_instance.$set(switch_instance_changes);
				}
			},
			i(local) {
				if (current) return;
				if (switch_instance) transition_in(switch_instance.$$.fragment, local);
				current = true;
			},
			o(local) {
				if (switch_instance) transition_out(switch_instance.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(switch_instance_anchor);
				}

				/*switch_instance_binding*/ ctx[11](null);
				if (switch_instance) destroy_component(switch_instance, detaching);
			}
		};
	}

	function instance$b($$self, $$props, $$invalidate) {
		const omit_props_names = ["use","class","component","tag","getElement"];
		let $$restProps = compute_rest_props($$props, omit_props_names);
		let { $$slots: slots = {}, $$scope } = $$props;
		const forwardEvents = forwardEventsBuilder(get_current_component());
		let { use = [] } = $$props;
		let { class: className = '' } = $$props;
		let element;
		let { component = SmuiElement } = $$props;
		let { tag = component === SmuiElement ? 'span' : undefined } = $$props;
		const context = getContext('SMUI:label:context');
		const tabindex = getContext('SMUI:label:tabindex');

		function getElement() {
			return element.getElement();
		}

		function switch_instance_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				element = $$value;
				$$invalidate(4, element);
			});
		}

		$$self.$$set = $$new_props => {
			$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
			$$invalidate(8, $$restProps = compute_rest_props($$props, omit_props_names));
			if ('use' in $$new_props) $$invalidate(0, use = $$new_props.use);
			if ('class' in $$new_props) $$invalidate(1, className = $$new_props.class);
			if ('component' in $$new_props) $$invalidate(2, component = $$new_props.component);
			if ('tag' in $$new_props) $$invalidate(3, tag = $$new_props.tag);
			if ('$$scope' in $$new_props) $$invalidate(12, $$scope = $$new_props.$$scope);
		};

		return [
			use,
			className,
			component,
			tag,
			element,
			forwardEvents,
			context,
			tabindex,
			$$restProps,
			getElement,
			slots,
			switch_instance_binding,
			$$scope
		];
	}

	class CommonLabel extends SvelteComponent {
		constructor(options) {
			super();

			init(this, options, instance$b, create_fragment$j, safe_not_equal, {
				use: 0,
				class: 1,
				component: 2,
				tag: 3,
				getElement: 9
			});
		}

		get getElement() {
			return this.$$.ctx[9];
		}
	}

	/* node_modules/@smui/common/dist/SmuiElement.svelte generated by Svelte v4.2.7 */

	function create_else_block$2(ctx) {
		let previous_tag = /*tag*/ ctx[1];
		let svelte_element_anchor;
		let current;
		let svelte_element = /*tag*/ ctx[1] && create_dynamic_element_1(ctx);

		return {
			c() {
				if (svelte_element) svelte_element.c();
				svelte_element_anchor = empty();
			},
			m(target, anchor) {
				if (svelte_element) svelte_element.m(target, anchor);
				insert(target, svelte_element_anchor, anchor);
				current = true;
			},
			p(ctx, dirty) {
				if (/*tag*/ ctx[1]) {
					if (!previous_tag) {
						svelte_element = create_dynamic_element_1(ctx);
						previous_tag = /*tag*/ ctx[1];
						svelte_element.c();
						svelte_element.m(svelte_element_anchor.parentNode, svelte_element_anchor);
					} else if (safe_not_equal(previous_tag, /*tag*/ ctx[1])) {
						svelte_element.d(1);
						svelte_element = create_dynamic_element_1(ctx);
						previous_tag = /*tag*/ ctx[1];
						svelte_element.c();
						svelte_element.m(svelte_element_anchor.parentNode, svelte_element_anchor);
					} else {
						svelte_element.p(ctx, dirty);
					}
				} else if (previous_tag) {
					svelte_element.d(1);
					svelte_element = null;
					previous_tag = /*tag*/ ctx[1];
				}
			},
			i(local) {
				if (current) return;
				transition_in(svelte_element, local);
				current = true;
			},
			o(local) {
				transition_out(svelte_element, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(svelte_element_anchor);
				}

				if (svelte_element) svelte_element.d(detaching);
			}
		};
	}

	// (8:22) 
	function create_if_block_1$4(ctx) {
		let previous_tag = /*tag*/ ctx[1];
		let svelte_element_anchor;
		let svelte_element = /*tag*/ ctx[1] && create_dynamic_element(ctx);

		return {
			c() {
				if (svelte_element) svelte_element.c();
				svelte_element_anchor = empty();
			},
			m(target, anchor) {
				if (svelte_element) svelte_element.m(target, anchor);
				insert(target, svelte_element_anchor, anchor);
			},
			p(ctx, dirty) {
				if (/*tag*/ ctx[1]) {
					if (!previous_tag) {
						svelte_element = create_dynamic_element(ctx);
						previous_tag = /*tag*/ ctx[1];
						svelte_element.c();
						svelte_element.m(svelte_element_anchor.parentNode, svelte_element_anchor);
					} else if (safe_not_equal(previous_tag, /*tag*/ ctx[1])) {
						svelte_element.d(1);
						svelte_element = create_dynamic_element(ctx);
						previous_tag = /*tag*/ ctx[1];
						svelte_element.c();
						svelte_element.m(svelte_element_anchor.parentNode, svelte_element_anchor);
					} else {
						svelte_element.p(ctx, dirty);
					}
				} else if (previous_tag) {
					svelte_element.d(1);
					svelte_element = null;
					previous_tag = /*tag*/ ctx[1];
				}
			},
			i: noop,
			o: noop,
			d(detaching) {
				if (detaching) {
					detach(svelte_element_anchor);
				}

				if (svelte_element) svelte_element.d(detaching);
			}
		};
	}

	// (1:0) {#if tag === 'svg'}
	function create_if_block$5(ctx) {
		let svg;
		let useActions_action;
		let current;
		let mounted;
		let dispose;
		const default_slot_template = /*#slots*/ ctx[8].default;
		const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[7], null);
		let svg_levels = [/*$$restProps*/ ctx[5]];
		let svg_data = {};

		for (let i = 0; i < svg_levels.length; i += 1) {
			svg_data = assign(svg_data, svg_levels[i]);
		}

		return {
			c() {
				svg = svg_element("svg");
				if (default_slot) default_slot.c();
				set_svg_attributes(svg, svg_data);
			},
			m(target, anchor) {
				insert(target, svg, anchor);

				if (default_slot) {
					default_slot.m(svg, null);
				}

				/*svg_binding*/ ctx[9](svg);
				current = true;

				if (!mounted) {
					dispose = [
						action_destroyer(useActions_action = useActions.call(null, svg, /*use*/ ctx[0])),
						action_destroyer(/*forwardEvents*/ ctx[4].call(null, svg))
					];

					mounted = true;
				}
			},
			p(ctx, dirty) {
				if (default_slot) {
					if (default_slot.p && (!current || dirty & /*$$scope*/ 128)) {
						update_slot_base(
							default_slot,
							default_slot_template,
							ctx,
							/*$$scope*/ ctx[7],
							!current
							? get_all_dirty_from_scope(/*$$scope*/ ctx[7])
							: get_slot_changes(default_slot_template, /*$$scope*/ ctx[7], dirty, null),
							null
						);
					}
				}

				set_svg_attributes(svg, svg_data = get_spread_update(svg_levels, [dirty & /*$$restProps*/ 32 && /*$$restProps*/ ctx[5]]));
				if (useActions_action && is_function(useActions_action.update) && dirty & /*use*/ 1) useActions_action.update.call(null, /*use*/ ctx[0]);
			},
			i(local) {
				if (current) return;
				transition_in(default_slot, local);
				current = true;
			},
			o(local) {
				transition_out(default_slot, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(svg);
				}

				if (default_slot) default_slot.d(detaching);
				/*svg_binding*/ ctx[9](null);
				mounted = false;
				run_all(dispose);
			}
		};
	}

	// (17:2) <svelte:element     this={tag}     bind:this={element}     use:useActions={use}     use:forwardEvents     {...$$restProps}>
	function create_dynamic_element_1(ctx) {
		let svelte_element;
		let useActions_action;
		let current;
		let mounted;
		let dispose;
		const default_slot_template = /*#slots*/ ctx[8].default;
		const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[7], null);
		let svelte_element_levels = [/*$$restProps*/ ctx[5]];
		let svelte_element_data = {};

		for (let i = 0; i < svelte_element_levels.length; i += 1) {
			svelte_element_data = assign(svelte_element_data, svelte_element_levels[i]);
		}

		return {
			c() {
				svelte_element = element(/*tag*/ ctx[1]);
				if (default_slot) default_slot.c();
				set_dynamic_element_data(/*tag*/ ctx[1])(svelte_element, svelte_element_data);
			},
			m(target, anchor) {
				insert(target, svelte_element, anchor);

				if (default_slot) {
					default_slot.m(svelte_element, null);
				}

				/*svelte_element_binding_1*/ ctx[11](svelte_element);
				current = true;

				if (!mounted) {
					dispose = [
						action_destroyer(useActions_action = useActions.call(null, svelte_element, /*use*/ ctx[0])),
						action_destroyer(/*forwardEvents*/ ctx[4].call(null, svelte_element))
					];

					mounted = true;
				}
			},
			p(ctx, dirty) {
				if (default_slot) {
					if (default_slot.p && (!current || dirty & /*$$scope*/ 128)) {
						update_slot_base(
							default_slot,
							default_slot_template,
							ctx,
							/*$$scope*/ ctx[7],
							!current
							? get_all_dirty_from_scope(/*$$scope*/ ctx[7])
							: get_slot_changes(default_slot_template, /*$$scope*/ ctx[7], dirty, null),
							null
						);
					}
				}

				set_dynamic_element_data(/*tag*/ ctx[1])(svelte_element, svelte_element_data = get_spread_update(svelte_element_levels, [dirty & /*$$restProps*/ 32 && /*$$restProps*/ ctx[5]]));
				if (useActions_action && is_function(useActions_action.update) && dirty & /*use*/ 1) useActions_action.update.call(null, /*use*/ ctx[0]);
			},
			i(local) {
				if (current) return;
				transition_in(default_slot, local);
				current = true;
			},
			o(local) {
				transition_out(default_slot, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(svelte_element);
				}

				if (default_slot) default_slot.d(detaching);
				/*svelte_element_binding_1*/ ctx[11](null);
				mounted = false;
				run_all(dispose);
			}
		};
	}

	// (9:2) <svelte:element     this={tag}     bind:this={element}     use:useActions={use}     use:forwardEvents     {...$$restProps}   />
	function create_dynamic_element(ctx) {
		let svelte_element;
		let useActions_action;
		let mounted;
		let dispose;
		let svelte_element_levels = [/*$$restProps*/ ctx[5]];
		let svelte_element_data = {};

		for (let i = 0; i < svelte_element_levels.length; i += 1) {
			svelte_element_data = assign(svelte_element_data, svelte_element_levels[i]);
		}

		return {
			c() {
				svelte_element = element(/*tag*/ ctx[1]);
				set_dynamic_element_data(/*tag*/ ctx[1])(svelte_element, svelte_element_data);
			},
			m(target, anchor) {
				insert(target, svelte_element, anchor);
				/*svelte_element_binding*/ ctx[10](svelte_element);

				if (!mounted) {
					dispose = [
						action_destroyer(useActions_action = useActions.call(null, svelte_element, /*use*/ ctx[0])),
						action_destroyer(/*forwardEvents*/ ctx[4].call(null, svelte_element))
					];

					mounted = true;
				}
			},
			p(ctx, dirty) {
				set_dynamic_element_data(/*tag*/ ctx[1])(svelte_element, svelte_element_data = get_spread_update(svelte_element_levels, [dirty & /*$$restProps*/ 32 && /*$$restProps*/ ctx[5]]));
				if (useActions_action && is_function(useActions_action.update) && dirty & /*use*/ 1) useActions_action.update.call(null, /*use*/ ctx[0]);
			},
			d(detaching) {
				if (detaching) {
					detach(svelte_element);
				}

				/*svelte_element_binding*/ ctx[10](null);
				mounted = false;
				run_all(dispose);
			}
		};
	}

	function create_fragment$i(ctx) {
		let current_block_type_index;
		let if_block;
		let if_block_anchor;
		let current;
		const if_block_creators = [create_if_block$5, create_if_block_1$4, create_else_block$2];
		const if_blocks = [];

		function select_block_type(ctx, dirty) {
			if (/*tag*/ ctx[1] === 'svg') return 0;
			if (/*selfClosing*/ ctx[3]) return 1;
			return 2;
		}

		current_block_type_index = select_block_type(ctx);
		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

		return {
			c() {
				if_block.c();
				if_block_anchor = empty();
			},
			m(target, anchor) {
				if_blocks[current_block_type_index].m(target, anchor);
				insert(target, if_block_anchor, anchor);
				current = true;
			},
			p(ctx, [dirty]) {
				let previous_block_index = current_block_type_index;
				current_block_type_index = select_block_type(ctx);

				if (current_block_type_index === previous_block_index) {
					if_blocks[current_block_type_index].p(ctx, dirty);
				} else {
					group_outros();

					transition_out(if_blocks[previous_block_index], 1, 1, () => {
						if_blocks[previous_block_index] = null;
					});

					check_outros();
					if_block = if_blocks[current_block_type_index];

					if (!if_block) {
						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
						if_block.c();
					} else {
						if_block.p(ctx, dirty);
					}

					transition_in(if_block, 1);
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			},
			i(local) {
				if (current) return;
				transition_in(if_block);
				current = true;
			},
			o(local) {
				transition_out(if_block);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(if_block_anchor);
				}

				if_blocks[current_block_type_index].d(detaching);
			}
		};
	}

	function instance$a($$self, $$props, $$invalidate) {
		let selfClosing;
		const omit_props_names = ["use","tag","getElement"];
		let $$restProps = compute_rest_props($$props, omit_props_names);
		let { $$slots: slots = {}, $$scope } = $$props;
		let { use = [] } = $$props;
		let { tag } = $$props;
		const forwardEvents = forwardEventsBuilder(get_current_component());
		let element;

		function getElement() {
			return element;
		}

		function svg_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				element = $$value;
				$$invalidate(2, element);
			});
		}

		function svelte_element_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				element = $$value;
				$$invalidate(2, element);
			});
		}

		function svelte_element_binding_1($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				element = $$value;
				$$invalidate(2, element);
			});
		}

		$$self.$$set = $$new_props => {
			$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
			$$invalidate(5, $$restProps = compute_rest_props($$props, omit_props_names));
			if ('use' in $$new_props) $$invalidate(0, use = $$new_props.use);
			if ('tag' in $$new_props) $$invalidate(1, tag = $$new_props.tag);
			if ('$$scope' in $$new_props) $$invalidate(7, $$scope = $$new_props.$$scope);
		};

		$$self.$$.update = () => {
			if ($$self.$$.dirty & /*tag*/ 2) {
				$$invalidate(3, selfClosing = [
					'area',
					'base',
					'br',
					'col',
					'embed',
					'hr',
					'img',
					'input',
					'link',
					'meta',
					'param',
					'source',
					'track',
					'wbr'
				].indexOf(tag) > -1);
			}
		};

		return [
			use,
			tag,
			element,
			selfClosing,
			forwardEvents,
			$$restProps,
			getElement,
			$$scope,
			slots,
			svg_binding,
			svelte_element_binding,
			svelte_element_binding_1
		];
	}

	class SmuiElement extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$a, create_fragment$i, safe_not_equal, { use: 0, tag: 1, getElement: 6 });
		}

		get getElement() {
			return this.$$.ctx[6];
		}
	}

	/* node_modules/@smui/common/dist/ContextFragment.svelte generated by Svelte v4.2.7 */

	function create_fragment$h(ctx) {
		let current;
		const default_slot_template = /*#slots*/ ctx[4].default;
		const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[3], null);

		return {
			c() {
				if (default_slot) default_slot.c();
			},
			m(target, anchor) {
				if (default_slot) {
					default_slot.m(target, anchor);
				}

				current = true;
			},
			p(ctx, [dirty]) {
				if (default_slot) {
					if (default_slot.p && (!current || dirty & /*$$scope*/ 8)) {
						update_slot_base(
							default_slot,
							default_slot_template,
							ctx,
							/*$$scope*/ ctx[3],
							!current
							? get_all_dirty_from_scope(/*$$scope*/ ctx[3])
							: get_slot_changes(default_slot_template, /*$$scope*/ ctx[3], dirty, null),
							null
						);
					}
				}
			},
			i(local) {
				if (current) return;
				transition_in(default_slot, local);
				current = true;
			},
			o(local) {
				transition_out(default_slot, local);
				current = false;
			},
			d(detaching) {
				if (default_slot) default_slot.d(detaching);
			}
		};
	}

	function instance$9($$self, $$props, $$invalidate) {
		let $storeValue;
		let { $$slots: slots = {}, $$scope } = $$props;
		let { key } = $$props;
		let { value } = $$props;
		const storeValue = writable(value);
		component_subscribe($$self, storeValue, value => $$invalidate(5, $storeValue = value));
		setContext(key, storeValue);

		onDestroy(() => {
			storeValue.set(undefined);
		});

		$$self.$$set = $$props => {
			if ('key' in $$props) $$invalidate(1, key = $$props.key);
			if ('value' in $$props) $$invalidate(2, value = $$props.value);
			if ('$$scope' in $$props) $$invalidate(3, $$scope = $$props.$$scope);
		};

		$$self.$$.update = () => {
			if ($$self.$$.dirty & /*value*/ 4) {
				set_store_value(storeValue, $storeValue = value, $storeValue);
			}
		};

		return [storeValue, key, value, $$scope, slots];
	}

	class ContextFragment extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$9, create_fragment$h, safe_not_equal, { key: 1, value: 2 });
		}
	}

	/* node_modules/@smui/common/dist/classadder/ClassAdder.svelte generated by Svelte v4.2.7 */

	function create_default_slot$7(ctx) {
		let current;
		const default_slot_template = /*#slots*/ ctx[11].default;
		const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[13], null);

		return {
			c() {
				if (default_slot) default_slot.c();
			},
			m(target, anchor) {
				if (default_slot) {
					default_slot.m(target, anchor);
				}

				current = true;
			},
			p(ctx, dirty) {
				if (default_slot) {
					if (default_slot.p && (!current || dirty & /*$$scope*/ 8192)) {
						update_slot_base(
							default_slot,
							default_slot_template,
							ctx,
							/*$$scope*/ ctx[13],
							!current
							? get_all_dirty_from_scope(/*$$scope*/ ctx[13])
							: get_slot_changes(default_slot_template, /*$$scope*/ ctx[13], dirty, null),
							null
						);
					}
				}
			},
			i(local) {
				if (current) return;
				transition_in(default_slot, local);
				current = true;
			},
			o(local) {
				transition_out(default_slot, local);
				current = false;
			},
			d(detaching) {
				if (default_slot) default_slot.d(detaching);
			}
		};
	}

	function create_fragment$g(ctx) {
		let switch_instance;
		let switch_instance_anchor;
		let current;

		const switch_instance_spread_levels = [
			{ tag: /*tag*/ ctx[3] },
			{
				use: [/*forwardEvents*/ ctx[8], .../*use*/ ctx[0]]
			},
			{
				class: classMap({
					[/*className*/ ctx[1]]: true,
					[/*smuiClass*/ ctx[6]]: true,
					.../*smuiClassMap*/ ctx[5]
				})
			},
			/*props*/ ctx[7],
			/*$$restProps*/ ctx[9]
		];

		var switch_value = /*component*/ ctx[2];

		function switch_props(ctx, dirty) {
			let switch_instance_props = {
				$$slots: { default: [create_default_slot$7] },
				$$scope: { ctx }
			};

			if (dirty !== undefined && dirty & /*tag, forwardEvents, use, className, smuiClass, smuiClassMap, props, $$restProps*/ 1003) {
				switch_instance_props = get_spread_update(switch_instance_spread_levels, [
					dirty & /*tag*/ 8 && { tag: /*tag*/ ctx[3] },
					dirty & /*forwardEvents, use*/ 257 && {
						use: [/*forwardEvents*/ ctx[8], .../*use*/ ctx[0]]
					},
					dirty & /*className, smuiClass, smuiClassMap*/ 98 && {
						class: classMap({
							[/*className*/ ctx[1]]: true,
							[/*smuiClass*/ ctx[6]]: true,
							.../*smuiClassMap*/ ctx[5]
						})
					},
					dirty & /*props*/ 128 && get_spread_object(/*props*/ ctx[7]),
					dirty & /*$$restProps*/ 512 && get_spread_object(/*$$restProps*/ ctx[9])
				]);
			} else {
				for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
					switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
				}
			}

			return { props: switch_instance_props };
		}

		if (switch_value) {
			switch_instance = construct_svelte_component(switch_value, switch_props(ctx));
			/*switch_instance_binding*/ ctx[12](switch_instance);
		}

		return {
			c() {
				if (switch_instance) create_component(switch_instance.$$.fragment);
				switch_instance_anchor = empty();
			},
			m(target, anchor) {
				if (switch_instance) mount_component(switch_instance, target, anchor);
				insert(target, switch_instance_anchor, anchor);
				current = true;
			},
			p(ctx, [dirty]) {
				if (dirty & /*component*/ 4 && switch_value !== (switch_value = /*component*/ ctx[2])) {
					if (switch_instance) {
						group_outros();
						const old_component = switch_instance;

						transition_out(old_component.$$.fragment, 1, 0, () => {
							destroy_component(old_component, 1);
						});

						check_outros();
					}

					if (switch_value) {
						switch_instance = construct_svelte_component(switch_value, switch_props(ctx, dirty));
						/*switch_instance_binding*/ ctx[12](switch_instance);
						create_component(switch_instance.$$.fragment);
						transition_in(switch_instance.$$.fragment, 1);
						mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
					} else {
						switch_instance = null;
					}
				} else if (switch_value) {
					const switch_instance_changes = (dirty & /*tag, forwardEvents, use, className, smuiClass, smuiClassMap, props, $$restProps*/ 1003)
					? get_spread_update(switch_instance_spread_levels, [
							dirty & /*tag*/ 8 && { tag: /*tag*/ ctx[3] },
							dirty & /*forwardEvents, use*/ 257 && {
								use: [/*forwardEvents*/ ctx[8], .../*use*/ ctx[0]]
							},
							dirty & /*className, smuiClass, smuiClassMap*/ 98 && {
								class: classMap({
									[/*className*/ ctx[1]]: true,
									[/*smuiClass*/ ctx[6]]: true,
									.../*smuiClassMap*/ ctx[5]
								})
							},
							dirty & /*props*/ 128 && get_spread_object(/*props*/ ctx[7]),
							dirty & /*$$restProps*/ 512 && get_spread_object(/*$$restProps*/ ctx[9])
						])
					: {};

					if (dirty & /*$$scope*/ 8192) {
						switch_instance_changes.$$scope = { dirty, ctx };
					}

					switch_instance.$set(switch_instance_changes);
				}
			},
			i(local) {
				if (current) return;
				if (switch_instance) transition_in(switch_instance.$$.fragment, local);
				current = true;
			},
			o(local) {
				if (switch_instance) transition_out(switch_instance.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(switch_instance_anchor);
				}

				/*switch_instance_binding*/ ctx[12](null);
				if (switch_instance) destroy_component(switch_instance, detaching);
			}
		};
	}

	const internals = {
		component: SmuiElement,
		tag: 'div',
		class: '',
		classMap: {},
		contexts: {},
		props: {}
	};

	function instance$8($$self, $$props, $$invalidate) {
		const omit_props_names = ["use","class","component","tag","getElement"];
		let $$restProps = compute_rest_props($$props, omit_props_names);
		let { $$slots: slots = {}, $$scope } = $$props;
		let { use = [] } = $$props;
		let { class: className = '' } = $$props;
		let element;
		const smuiClass = internals.class;
		const smuiClassMap = {};
		const smuiClassUnsubscribes = [];
		const contexts = internals.contexts;
		const props = internals.props;
		let { component = internals.component } = $$props;
		let { tag = component === SmuiElement ? internals.tag : undefined } = $$props;

		Object.entries(internals.classMap).forEach(([name, context]) => {
			const store = getContext(context);

			if (store && 'subscribe' in store) {
				smuiClassUnsubscribes.push(store.subscribe(value => {
					$$invalidate(5, smuiClassMap[name] = value, smuiClassMap);
				}));
			}
		});

		const forwardEvents = forwardEventsBuilder(get_current_component());

		for (let context in contexts) {
			if (contexts.hasOwnProperty(context)) {
				setContext(context, contexts[context]);
			}
		}

		onDestroy(() => {
			for (const unsubscribe of smuiClassUnsubscribes) {
				unsubscribe();
			}
		});

		function getElement() {
			return element.getElement();
		}

		function switch_instance_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				element = $$value;
				$$invalidate(4, element);
			});
		}

		$$self.$$set = $$new_props => {
			$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
			$$invalidate(9, $$restProps = compute_rest_props($$props, omit_props_names));
			if ('use' in $$new_props) $$invalidate(0, use = $$new_props.use);
			if ('class' in $$new_props) $$invalidate(1, className = $$new_props.class);
			if ('component' in $$new_props) $$invalidate(2, component = $$new_props.component);
			if ('tag' in $$new_props) $$invalidate(3, tag = $$new_props.tag);
			if ('$$scope' in $$new_props) $$invalidate(13, $$scope = $$new_props.$$scope);
		};

		return [
			use,
			className,
			component,
			tag,
			element,
			smuiClassMap,
			smuiClass,
			props,
			forwardEvents,
			$$restProps,
			getElement,
			slots,
			switch_instance_binding,
			$$scope
		];
	}

	class ClassAdder extends SvelteComponent {
		constructor(options) {
			super();

			init(this, options, instance$8, create_fragment$g, safe_not_equal, {
				use: 0,
				class: 1,
				component: 2,
				tag: 3,
				getElement: 10
			});
		}

		get getElement() {
			return this.$$.ctx[10];
		}
	}

	// @ts-ignore: Internals is exported... argh.
	const defaults = Object.assign({}, internals);
	function classAdderBuilder(props) {
	    return new Proxy(ClassAdder, {
	        construct: function (target, args) {
	            Object.assign(internals, defaults, props);
	            // @ts-ignore: Need spread arg.
	            return new target(...args);
	        },
	        get: function (target, prop) {
	            Object.assign(internals, defaults, props);
	            return target[prop];
	        },
	    });
	}

	var Row = classAdderBuilder({
	    class: 'mdc-top-app-bar__row',
	    tag: 'div',
	});

	/* node_modules/@smui/top-app-bar/dist/Section.svelte generated by Svelte v4.2.7 */

	function create_fragment$f(ctx) {
		let section;
		let section_class_value;
		let useActions_action;
		let current;
		let mounted;
		let dispose;
		const default_slot_template = /*#slots*/ ctx[9].default;
		const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[8], null);

		let section_levels = [
			{
				class: section_class_value = classMap({
					[/*className*/ ctx[1]]: true,
					'mdc-top-app-bar__section': true,
					'mdc-top-app-bar__section--align-start': /*align*/ ctx[2] === 'start',
					'mdc-top-app-bar__section--align-end': /*align*/ ctx[2] === 'end'
				})
			},
			/*toolbar*/ ctx[3] ? { role: 'toolbar' } : {},
			/*$$restProps*/ ctx[6]
		];

		let section_data = {};

		for (let i = 0; i < section_levels.length; i += 1) {
			section_data = assign(section_data, section_levels[i]);
		}

		return {
			c() {
				section = element("section");
				if (default_slot) default_slot.c();
				set_attributes(section, section_data);
			},
			m(target, anchor) {
				insert(target, section, anchor);

				if (default_slot) {
					default_slot.m(section, null);
				}

				/*section_binding*/ ctx[10](section);
				current = true;

				if (!mounted) {
					dispose = [
						action_destroyer(useActions_action = useActions.call(null, section, /*use*/ ctx[0])),
						action_destroyer(/*forwardEvents*/ ctx[5].call(null, section))
					];

					mounted = true;
				}
			},
			p(ctx, [dirty]) {
				if (default_slot) {
					if (default_slot.p && (!current || dirty & /*$$scope*/ 256)) {
						update_slot_base(
							default_slot,
							default_slot_template,
							ctx,
							/*$$scope*/ ctx[8],
							!current
							? get_all_dirty_from_scope(/*$$scope*/ ctx[8])
							: get_slot_changes(default_slot_template, /*$$scope*/ ctx[8], dirty, null),
							null
						);
					}
				}

				set_attributes(section, section_data = get_spread_update(section_levels, [
					(!current || dirty & /*className, align*/ 6 && section_class_value !== (section_class_value = classMap({
						[/*className*/ ctx[1]]: true,
						'mdc-top-app-bar__section': true,
						'mdc-top-app-bar__section--align-start': /*align*/ ctx[2] === 'start',
						'mdc-top-app-bar__section--align-end': /*align*/ ctx[2] === 'end'
					}))) && { class: section_class_value },
					dirty & /*toolbar*/ 8 && (/*toolbar*/ ctx[3] ? { role: 'toolbar' } : {}),
					dirty & /*$$restProps*/ 64 && /*$$restProps*/ ctx[6]
				]));

				if (useActions_action && is_function(useActions_action.update) && dirty & /*use*/ 1) useActions_action.update.call(null, /*use*/ ctx[0]);
			},
			i(local) {
				if (current) return;
				transition_in(default_slot, local);
				current = true;
			},
			o(local) {
				transition_out(default_slot, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(section);
				}

				if (default_slot) default_slot.d(detaching);
				/*section_binding*/ ctx[10](null);
				mounted = false;
				run_all(dispose);
			}
		};
	}

	function instance$7($$self, $$props, $$invalidate) {
		const omit_props_names = ["use","class","align","toolbar","getElement"];
		let $$restProps = compute_rest_props($$props, omit_props_names);
		let { $$slots: slots = {}, $$scope } = $$props;
		const forwardEvents = forwardEventsBuilder(get_current_component());
		let { use = [] } = $$props;
		let { class: className = '' } = $$props;
		let { align = 'start' } = $$props;
		let { toolbar = false } = $$props;
		let element;

		setContext('SMUI:icon-button:context', toolbar
		? 'top-app-bar:action'
		: 'top-app-bar:navigation');

		setContext('SMUI:button:context', toolbar
		? 'top-app-bar:action'
		: 'top-app-bar:navigation');

		function getElement() {
			return element;
		}

		function section_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				element = $$value;
				$$invalidate(4, element);
			});
		}

		$$self.$$set = $$new_props => {
			$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
			$$invalidate(6, $$restProps = compute_rest_props($$props, omit_props_names));
			if ('use' in $$new_props) $$invalidate(0, use = $$new_props.use);
			if ('class' in $$new_props) $$invalidate(1, className = $$new_props.class);
			if ('align' in $$new_props) $$invalidate(2, align = $$new_props.align);
			if ('toolbar' in $$new_props) $$invalidate(3, toolbar = $$new_props.toolbar);
			if ('$$scope' in $$new_props) $$invalidate(8, $$scope = $$new_props.$$scope);
		};

		return [
			use,
			className,
			align,
			toolbar,
			element,
			forwardEvents,
			$$restProps,
			getElement,
			$$scope,
			slots,
			section_binding
		];
	}

	class Section extends SvelteComponent {
		constructor(options) {
			super();

			init(this, options, instance$7, create_fragment$f, safe_not_equal, {
				use: 0,
				class: 1,
				align: 2,
				toolbar: 3,
				getElement: 7
			});
		}

		get getElement() {
			return this.$$.ctx[7];
		}
	}

	var Title = classAdderBuilder({
	    class: 'mdc-top-app-bar__title',
	    tag: 'span',
	});

	/**
	 * @license
	 * Copyright 2018 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */
	var cssClasses$6 = {
	    ACTIVE: 'mdc-tab-indicator--active',
	    FADE: 'mdc-tab-indicator--fade',
	    NO_TRANSITION: 'mdc-tab-indicator--no-transition',
	};
	var strings$8 = {
	    CONTENT_SELECTOR: '.mdc-tab-indicator__content',
	};

	/**
	 * @license
	 * Copyright 2018 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */
	var MDCTabIndicatorFoundation = /** @class */ (function (_super) {
	    __extends(MDCTabIndicatorFoundation, _super);
	    function MDCTabIndicatorFoundation(adapter) {
	        return _super.call(this, __assign(__assign({}, MDCTabIndicatorFoundation.defaultAdapter), adapter)) || this;
	    }
	    Object.defineProperty(MDCTabIndicatorFoundation, "cssClasses", {
	        get: function () {
	            return cssClasses$6;
	        },
	        enumerable: false,
	        configurable: true
	    });
	    Object.defineProperty(MDCTabIndicatorFoundation, "strings", {
	        get: function () {
	            return strings$8;
	        },
	        enumerable: false,
	        configurable: true
	    });
	    Object.defineProperty(MDCTabIndicatorFoundation, "defaultAdapter", {
	        get: function () {
	            // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
	            return {
	                addClass: function () { return undefined; },
	                removeClass: function () { return undefined; },
	                computeContentClientRect: function () {
	                    return ({ top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0 });
	                },
	                setContentStyleProperty: function () { return undefined; },
	            };
	            // tslint:enable:object-literal-sort-keys
	        },
	        enumerable: false,
	        configurable: true
	    });
	    MDCTabIndicatorFoundation.prototype.computeContentClientRect = function () {
	        return this.adapter.computeContentClientRect();
	    };
	    return MDCTabIndicatorFoundation;
	}(MDCFoundation));

	/**
	 * @license
	 * Copyright 2018 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */
	/* istanbul ignore next: subclass is not a branch statement */
	var MDCFadingTabIndicatorFoundation = /** @class */ (function (_super) {
	    __extends(MDCFadingTabIndicatorFoundation, _super);
	    function MDCFadingTabIndicatorFoundation() {
	        return _super !== null && _super.apply(this, arguments) || this;
	    }
	    MDCFadingTabIndicatorFoundation.prototype.activate = function () {
	        this.adapter.addClass(MDCTabIndicatorFoundation.cssClasses.ACTIVE);
	    };
	    MDCFadingTabIndicatorFoundation.prototype.deactivate = function () {
	        this.adapter.removeClass(MDCTabIndicatorFoundation.cssClasses.ACTIVE);
	    };
	    return MDCFadingTabIndicatorFoundation;
	}(MDCTabIndicatorFoundation));

	/**
	 * @license
	 * Copyright 2018 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */
	/* istanbul ignore next: subclass is not a branch statement */
	var MDCSlidingTabIndicatorFoundation = /** @class */ (function (_super) {
	    __extends(MDCSlidingTabIndicatorFoundation, _super);
	    function MDCSlidingTabIndicatorFoundation() {
	        return _super !== null && _super.apply(this, arguments) || this;
	    }
	    MDCSlidingTabIndicatorFoundation.prototype.activate = function (previousIndicatorClientRect) {
	        // Early exit if no indicator is present to handle cases where an indicator
	        // may be activated without a prior indicator state
	        if (!previousIndicatorClientRect) {
	            this.adapter.addClass(MDCTabIndicatorFoundation.cssClasses.ACTIVE);
	            return;
	        }
	        // This animation uses the FLIP approach. You can read more about it at the link below:
	        // https://aerotwist.com/blog/flip-your-animations/
	        // Calculate the dimensions based on the dimensions of the previous indicator
	        var currentClientRect = this.computeContentClientRect();
	        var widthDelta = previousIndicatorClientRect.width / currentClientRect.width;
	        var xPosition = previousIndicatorClientRect.left - currentClientRect.left;
	        this.adapter.addClass(MDCTabIndicatorFoundation.cssClasses.NO_TRANSITION);
	        this.adapter.setContentStyleProperty('transform', "translateX(" + xPosition + "px) scaleX(" + widthDelta + ")");
	        // Force repaint before updating classes and transform to ensure the transform properly takes effect
	        this.computeContentClientRect();
	        this.adapter.removeClass(MDCTabIndicatorFoundation.cssClasses.NO_TRANSITION);
	        this.adapter.addClass(MDCTabIndicatorFoundation.cssClasses.ACTIVE);
	        this.adapter.setContentStyleProperty('transform', '');
	    };
	    MDCSlidingTabIndicatorFoundation.prototype.deactivate = function () {
	        this.adapter.removeClass(MDCTabIndicatorFoundation.cssClasses.ACTIVE);
	    };
	    return MDCSlidingTabIndicatorFoundation;
	}(MDCTabIndicatorFoundation));

	/**
	 * @license
	 * Copyright 2018 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */
	var cssClasses$5 = {
	    ACTIVE: 'mdc-tab--active',
	};
	var strings$7 = {
	    ARIA_SELECTED: 'aria-selected',
	    CONTENT_SELECTOR: '.mdc-tab__content',
	    INTERACTED_EVENT: 'MDCTab:interacted',
	    RIPPLE_SELECTOR: '.mdc-tab__ripple',
	    TABINDEX: 'tabIndex',
	    TAB_INDICATOR_SELECTOR: '.mdc-tab-indicator',
	};

	/**
	 * @license
	 * Copyright 2018 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */
	var MDCTabFoundation = /** @class */ (function (_super) {
	    __extends(MDCTabFoundation, _super);
	    function MDCTabFoundation(adapter) {
	        var _this = _super.call(this, __assign(__assign({}, MDCTabFoundation.defaultAdapter), adapter)) || this;
	        _this.focusOnActivate = true;
	        return _this;
	    }
	    Object.defineProperty(MDCTabFoundation, "cssClasses", {
	        get: function () {
	            return cssClasses$5;
	        },
	        enumerable: false,
	        configurable: true
	    });
	    Object.defineProperty(MDCTabFoundation, "strings", {
	        get: function () {
	            return strings$7;
	        },
	        enumerable: false,
	        configurable: true
	    });
	    Object.defineProperty(MDCTabFoundation, "defaultAdapter", {
	        get: function () {
	            // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
	            return {
	                addClass: function () { return undefined; },
	                removeClass: function () { return undefined; },
	                hasClass: function () { return false; },
	                setAttr: function () { return undefined; },
	                activateIndicator: function () { return undefined; },
	                deactivateIndicator: function () { return undefined; },
	                notifyInteracted: function () { return undefined; },
	                getOffsetLeft: function () { return 0; },
	                getOffsetWidth: function () { return 0; },
	                getContentOffsetLeft: function () { return 0; },
	                getContentOffsetWidth: function () { return 0; },
	                focus: function () { return undefined; },
	            };
	            // tslint:enable:object-literal-sort-keys
	        },
	        enumerable: false,
	        configurable: true
	    });
	    MDCTabFoundation.prototype.handleClick = function () {
	        // It's up to the parent component to keep track of the active Tab and
	        // ensure we don't activate a Tab that's already active.
	        this.adapter.notifyInteracted();
	    };
	    MDCTabFoundation.prototype.isActive = function () {
	        return this.adapter.hasClass(cssClasses$5.ACTIVE);
	    };
	    /**
	     * Sets whether the tab should focus itself when activated
	     */
	    MDCTabFoundation.prototype.setFocusOnActivate = function (focusOnActivate) {
	        this.focusOnActivate = focusOnActivate;
	    };
	    /**
	     * Activates the Tab
	     */
	    MDCTabFoundation.prototype.activate = function (previousIndicatorClientRect) {
	        this.adapter.addClass(cssClasses$5.ACTIVE);
	        this.adapter.setAttr(strings$7.ARIA_SELECTED, 'true');
	        this.adapter.setAttr(strings$7.TABINDEX, '0');
	        this.adapter.activateIndicator(previousIndicatorClientRect);
	        if (this.focusOnActivate) {
	            this.adapter.focus();
	        }
	    };
	    /**
	     * Deactivates the Tab
	     */
	    MDCTabFoundation.prototype.deactivate = function () {
	        // Early exit
	        if (!this.isActive()) {
	            return;
	        }
	        this.adapter.removeClass(cssClasses$5.ACTIVE);
	        this.adapter.setAttr(strings$7.ARIA_SELECTED, 'false');
	        this.adapter.setAttr(strings$7.TABINDEX, '-1');
	        this.adapter.deactivateIndicator();
	    };
	    /**
	     * Returns the dimensions of the Tab
	     */
	    MDCTabFoundation.prototype.computeDimensions = function () {
	        var rootWidth = this.adapter.getOffsetWidth();
	        var rootLeft = this.adapter.getOffsetLeft();
	        var contentWidth = this.adapter.getContentOffsetWidth();
	        var contentLeft = this.adapter.getContentOffsetLeft();
	        return {
	            contentLeft: rootLeft + contentLeft,
	            contentRight: rootLeft + contentLeft + contentWidth,
	            rootLeft: rootLeft,
	            rootRight: rootLeft + rootWidth,
	        };
	    };
	    return MDCTabFoundation;
	}(MDCFoundation));

	/**
	 * @license
	 * Copyright 2020 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */
	/**
	 * KEY provides normalized string values for keys.
	 */
	var KEY = {
	    UNKNOWN: 'Unknown',
	    BACKSPACE: 'Backspace',
	    ENTER: 'Enter',
	    SPACEBAR: 'Spacebar',
	    PAGE_UP: 'PageUp',
	    PAGE_DOWN: 'PageDown',
	    END: 'End',
	    HOME: 'Home',
	    ARROW_LEFT: 'ArrowLeft',
	    ARROW_UP: 'ArrowUp',
	    ARROW_RIGHT: 'ArrowRight',
	    ARROW_DOWN: 'ArrowDown',
	    DELETE: 'Delete',
	    ESCAPE: 'Escape',
	    TAB: 'Tab',
	};
	var normalizedKeys = new Set();
	// IE11 has no support for new Map with iterable so we need to initialize this
	// by hand.
	normalizedKeys.add(KEY.BACKSPACE);
	normalizedKeys.add(KEY.ENTER);
	normalizedKeys.add(KEY.SPACEBAR);
	normalizedKeys.add(KEY.PAGE_UP);
	normalizedKeys.add(KEY.PAGE_DOWN);
	normalizedKeys.add(KEY.END);
	normalizedKeys.add(KEY.HOME);
	normalizedKeys.add(KEY.ARROW_LEFT);
	normalizedKeys.add(KEY.ARROW_UP);
	normalizedKeys.add(KEY.ARROW_RIGHT);
	normalizedKeys.add(KEY.ARROW_DOWN);
	normalizedKeys.add(KEY.DELETE);
	normalizedKeys.add(KEY.ESCAPE);
	normalizedKeys.add(KEY.TAB);
	var KEY_CODE = {
	    BACKSPACE: 8,
	    ENTER: 13,
	    SPACEBAR: 32,
	    PAGE_UP: 33,
	    PAGE_DOWN: 34,
	    END: 35,
	    HOME: 36,
	    ARROW_LEFT: 37,
	    ARROW_UP: 38,
	    ARROW_RIGHT: 39,
	    ARROW_DOWN: 40,
	    DELETE: 46,
	    ESCAPE: 27,
	    TAB: 9,
	};
	var mappedKeyCodes = new Map();
	// IE11 has no support for new Map with iterable so we need to initialize this
	// by hand.
	mappedKeyCodes.set(KEY_CODE.BACKSPACE, KEY.BACKSPACE);
	mappedKeyCodes.set(KEY_CODE.ENTER, KEY.ENTER);
	mappedKeyCodes.set(KEY_CODE.SPACEBAR, KEY.SPACEBAR);
	mappedKeyCodes.set(KEY_CODE.PAGE_UP, KEY.PAGE_UP);
	mappedKeyCodes.set(KEY_CODE.PAGE_DOWN, KEY.PAGE_DOWN);
	mappedKeyCodes.set(KEY_CODE.END, KEY.END);
	mappedKeyCodes.set(KEY_CODE.HOME, KEY.HOME);
	mappedKeyCodes.set(KEY_CODE.ARROW_LEFT, KEY.ARROW_LEFT);
	mappedKeyCodes.set(KEY_CODE.ARROW_UP, KEY.ARROW_UP);
	mappedKeyCodes.set(KEY_CODE.ARROW_RIGHT, KEY.ARROW_RIGHT);
	mappedKeyCodes.set(KEY_CODE.ARROW_DOWN, KEY.ARROW_DOWN);
	mappedKeyCodes.set(KEY_CODE.DELETE, KEY.DELETE);
	mappedKeyCodes.set(KEY_CODE.ESCAPE, KEY.ESCAPE);
	mappedKeyCodes.set(KEY_CODE.TAB, KEY.TAB);
	var navigationKeys$1 = new Set();
	// IE11 has no support for new Set with iterable so we need to initialize this
	// by hand.
	navigationKeys$1.add(KEY.PAGE_UP);
	navigationKeys$1.add(KEY.PAGE_DOWN);
	navigationKeys$1.add(KEY.END);
	navigationKeys$1.add(KEY.HOME);
	navigationKeys$1.add(KEY.ARROW_LEFT);
	navigationKeys$1.add(KEY.ARROW_UP);
	navigationKeys$1.add(KEY.ARROW_RIGHT);
	navigationKeys$1.add(KEY.ARROW_DOWN);
	/**
	 * normalizeKey returns the normalized string for a navigational action.
	 */
	function normalizeKey(evt) {
	    var key = evt.key;
	    // If the event already has a normalized key, return it
	    if (normalizedKeys.has(key)) {
	        return key;
	    }
	    // tslint:disable-next-line:deprecation
	    var mappedKey = mappedKeyCodes.get(evt.keyCode);
	    if (mappedKey) {
	        return mappedKey;
	    }
	    return KEY.UNKNOWN;
	}
	/**
	 * isNavigationEvent returns whether the event is a navigation event
	 */
	function isNavigationEvent(evt) {
	    return navigationKeys$1.has(normalizeKey(evt));
	}

	const { applyPassive } = events;
	const { matches } = ponyfill;
	function Ripple(node, { ripple = true, surface = false, unbounded = false, disabled = false, color, active, rippleElement, eventTarget, activeTarget, addClass = (className) => node.classList.add(className), removeClass = (className) => node.classList.remove(className), addStyle = (name, value) => node.style.setProperty(name, value), initPromise = Promise.resolve(), } = {}) {
	    let instance;
	    let addLayoutListener = getContext('SMUI:addLayoutListener');
	    let removeLayoutListener;
	    let oldActive = active;
	    let oldEventTarget = eventTarget;
	    let oldActiveTarget = activeTarget;
	    function handleProps() {
	        if (surface) {
	            addClass('mdc-ripple-surface');
	            if (color === 'primary') {
	                addClass('smui-ripple-surface--primary');
	                removeClass('smui-ripple-surface--secondary');
	            }
	            else if (color === 'secondary') {
	                removeClass('smui-ripple-surface--primary');
	                addClass('smui-ripple-surface--secondary');
	            }
	            else {
	                removeClass('smui-ripple-surface--primary');
	                removeClass('smui-ripple-surface--secondary');
	            }
	        }
	        else {
	            removeClass('mdc-ripple-surface');
	            removeClass('smui-ripple-surface--primary');
	            removeClass('smui-ripple-surface--secondary');
	        }
	        // Handle activation first.
	        if (instance && oldActive !== active) {
	            oldActive = active;
	            if (active) {
	                instance.activate();
	            }
	            else if (active === false) {
	                instance.deactivate();
	            }
	        }
	        // Then create/destroy an instance.
	        if (ripple && !instance) {
	            instance = new MDCRippleFoundation({
	                addClass,
	                browserSupportsCssVars: () => supportsCssVariables(window),
	                computeBoundingRect: () => (rippleElement || node).getBoundingClientRect(),
	                containsEventTarget: (target) => node.contains(target),
	                deregisterDocumentInteractionHandler: (evtType, handler) => document.documentElement.removeEventListener(evtType, handler, applyPassive()),
	                deregisterInteractionHandler: (evtType, handler) => (eventTarget || node).removeEventListener(evtType, handler, applyPassive()),
	                deregisterResizeHandler: (handler) => window.removeEventListener('resize', handler),
	                getWindowPageOffset: () => ({
	                    x: window.pageXOffset,
	                    y: window.pageYOffset,
	                }),
	                isSurfaceActive: () => active == null ? matches(activeTarget || node, ':active') : active,
	                isSurfaceDisabled: () => !!disabled,
	                isUnbounded: () => !!unbounded,
	                registerDocumentInteractionHandler: (evtType, handler) => document.documentElement.addEventListener(evtType, handler, applyPassive()),
	                registerInteractionHandler: (evtType, handler) => (eventTarget || node).addEventListener(evtType, handler, applyPassive()),
	                registerResizeHandler: (handler) => window.addEventListener('resize', handler),
	                removeClass,
	                updateCssVariable: addStyle,
	            });
	            initPromise.then(() => {
	                if (instance) {
	                    instance.init();
	                    instance.setUnbounded(unbounded);
	                }
	            });
	        }
	        else if (instance && !ripple) {
	            initPromise.then(() => {
	                if (instance) {
	                    instance.destroy();
	                    instance = undefined;
	                }
	            });
	        }
	        // Now handle event/active targets
	        if (instance &&
	            (oldEventTarget !== eventTarget || oldActiveTarget !== activeTarget)) {
	            oldEventTarget = eventTarget;
	            oldActiveTarget = activeTarget;
	            instance.destroy();
	            requestAnimationFrame(() => {
	                if (instance) {
	                    instance.init();
	                    instance.setUnbounded(unbounded);
	                }
	            });
	        }
	        if (!ripple && unbounded) {
	            addClass('mdc-ripple-upgraded--unbounded');
	        }
	    }
	    handleProps();
	    if (addLayoutListener) {
	        removeLayoutListener = addLayoutListener(layout);
	    }
	    function layout() {
	        if (instance) {
	            instance.layout();
	        }
	    }
	    return {
	        update(props) {
	            ({
	                ripple,
	                surface,
	                unbounded,
	                disabled,
	                color,
	                active,
	                rippleElement,
	                eventTarget,
	                activeTarget,
	                addClass,
	                removeClass,
	                addStyle,
	                initPromise,
	            } = Object.assign({ ripple: true, surface: false, unbounded: false, disabled: false, color: undefined, active: undefined, rippleElement: undefined, eventTarget: undefined, activeTarget: undefined, addClass: (className) => node.classList.add(className), removeClass: (className) => node.classList.remove(className), addStyle: (name, value) => node.style.setProperty(name, value), initPromise: Promise.resolve() }, props));
	            handleProps();
	        },
	        destroy() {
	            if (instance) {
	                instance.destroy();
	                instance = undefined;
	                removeClass('mdc-ripple-surface');
	                removeClass('smui-ripple-surface--primary');
	                removeClass('smui-ripple-surface--secondary');
	            }
	            if (removeLayoutListener) {
	                removeLayoutListener();
	            }
	        },
	    };
	}

	/* node_modules/@smui/tab-indicator/dist/TabIndicator.svelte generated by Svelte v4.2.7 */

	function create_fragment$e(ctx) {
		let span1;
		let span0;
		let span0_class_value;
		let span0_style_value;
		let span0_aria_hidden_value;
		let useActions_action;
		let span1_class_value;
		let useActions_action_1;
		let current;
		let mounted;
		let dispose;
		const default_slot_template = /*#slots*/ ctx[21].default;
		const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[20], null);

		let span0_levels = [
			{
				class: span0_class_value = classMap({
					[/*content$class*/ ctx[6]]: true,
					'mdc-tab-indicator__content': true,
					'mdc-tab-indicator__content--underline': /*type*/ ctx[3] === 'underline',
					'mdc-tab-indicator__content--icon': /*type*/ ctx[3] === 'icon'
				})
			},
			{
				style: span0_style_value = Object.entries(/*contentStyles*/ ctx[10]).map(func$5).join(' ')
			},
			{
				"aria-hidden": span0_aria_hidden_value = /*type*/ ctx[3] === 'icon' ? 'true' : undefined
			},
			prefixFilter(/*$$restProps*/ ctx[12], 'content$')
		];

		let span_data = {};

		for (let i = 0; i < span0_levels.length; i += 1) {
			span_data = assign(span_data, span0_levels[i]);
		}

		let span1_levels = [
			{
				class: span1_class_value = classMap({
					[/*className*/ ctx[2]]: true,
					'mdc-tab-indicator': true,
					'mdc-tab-indicator--active': /*active*/ ctx[0],
					'mdc-tab-indicator--fade': /*transition*/ ctx[4] === 'fade',
					.../*internalClasses*/ ctx[9]
				})
			},
			exclude(/*$$restProps*/ ctx[12], ['content$'])
		];

		let span_data_1 = {};

		for (let i = 0; i < span1_levels.length; i += 1) {
			span_data_1 = assign(span_data_1, span1_levels[i]);
		}

		return {
			c() {
				span1 = element("span");
				span0 = element("span");
				if (default_slot) default_slot.c();
				set_attributes(span0, span_data);
				set_attributes(span1, span_data_1);
			},
			m(target, anchor) {
				insert(target, span1, anchor);
				append(span1, span0);

				if (default_slot) {
					default_slot.m(span0, null);
				}

				/*span0_binding*/ ctx[22](span0);
				/*span1_binding*/ ctx[23](span1);
				current = true;

				if (!mounted) {
					dispose = [
						action_destroyer(useActions_action = useActions.call(null, span0, /*content$use*/ ctx[5])),
						action_destroyer(useActions_action_1 = useActions.call(null, span1, /*use*/ ctx[1])),
						action_destroyer(/*forwardEvents*/ ctx[11].call(null, span1))
					];

					mounted = true;
				}
			},
			p(ctx, [dirty]) {
				if (default_slot) {
					if (default_slot.p && (!current || dirty & /*$$scope*/ 1048576)) {
						update_slot_base(
							default_slot,
							default_slot_template,
							ctx,
							/*$$scope*/ ctx[20],
							!current
							? get_all_dirty_from_scope(/*$$scope*/ ctx[20])
							: get_slot_changes(default_slot_template, /*$$scope*/ ctx[20], dirty, null),
							null
						);
					}
				}

				set_attributes(span0, span_data = get_spread_update(span0_levels, [
					(!current || dirty & /*content$class, type*/ 72 && span0_class_value !== (span0_class_value = classMap({
						[/*content$class*/ ctx[6]]: true,
						'mdc-tab-indicator__content': true,
						'mdc-tab-indicator__content--underline': /*type*/ ctx[3] === 'underline',
						'mdc-tab-indicator__content--icon': /*type*/ ctx[3] === 'icon'
					}))) && { class: span0_class_value },
					(!current || dirty & /*contentStyles*/ 1024 && span0_style_value !== (span0_style_value = Object.entries(/*contentStyles*/ ctx[10]).map(func$5).join(' '))) && { style: span0_style_value },
					(!current || dirty & /*type*/ 8 && span0_aria_hidden_value !== (span0_aria_hidden_value = /*type*/ ctx[3] === 'icon' ? 'true' : undefined)) && { "aria-hidden": span0_aria_hidden_value },
					dirty & /*$$restProps*/ 4096 && prefixFilter(/*$$restProps*/ ctx[12], 'content$')
				]));

				if (useActions_action && is_function(useActions_action.update) && dirty & /*content$use*/ 32) useActions_action.update.call(null, /*content$use*/ ctx[5]);

				set_attributes(span1, span_data_1 = get_spread_update(span1_levels, [
					(!current || dirty & /*className, active, transition, internalClasses*/ 533 && span1_class_value !== (span1_class_value = classMap({
						[/*className*/ ctx[2]]: true,
						'mdc-tab-indicator': true,
						'mdc-tab-indicator--active': /*active*/ ctx[0],
						'mdc-tab-indicator--fade': /*transition*/ ctx[4] === 'fade',
						.../*internalClasses*/ ctx[9]
					}))) && { class: span1_class_value },
					dirty & /*$$restProps*/ 4096 && exclude(/*$$restProps*/ ctx[12], ['content$'])
				]));

				if (useActions_action_1 && is_function(useActions_action_1.update) && dirty & /*use*/ 2) useActions_action_1.update.call(null, /*use*/ ctx[1]);
			},
			i(local) {
				if (current) return;
				transition_in(default_slot, local);
				current = true;
			},
			o(local) {
				transition_out(default_slot, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(span1);
				}

				if (default_slot) default_slot.d(detaching);
				/*span0_binding*/ ctx[22](null);
				/*span1_binding*/ ctx[23](null);
				mounted = false;
				run_all(dispose);
			}
		};
	}

	const func$5 = ([name, value]) => `${name}: ${value};`;

	function instance_1$7($$self, $$props, $$invalidate) {
		const omit_props_names = [
			"use","class","active","type","transition","content$use","content$class","activate","deactivate","computeContentClientRect","getElement"
		];

		let $$restProps = compute_rest_props($$props, omit_props_names);
		let { $$slots: slots = {}, $$scope } = $$props;
		const forwardEvents = forwardEventsBuilder(get_current_component());
		let { use = [] } = $$props;
		let { class: className = '' } = $$props;
		let { active = false } = $$props;
		let { type = 'underline' } = $$props;
		let { transition = 'slide' } = $$props;
		let { content$use = [] } = $$props;
		let { content$class = '' } = $$props;
		let element;
		let instance;
		let content;
		let internalClasses = {};
		let contentStyles = {};
		let changeSets = [];
		let oldTransition = transition;

		onMount(() => {
			$$invalidate(17, instance = getInstance());
			instance.init();

			return () => {
				instance.destroy();
			};
		});

		function getInstance() {
			const Foundation = ({
				fade: MDCFadingTabIndicatorFoundation,
				slide: MDCSlidingTabIndicatorFoundation
			})[transition] || MDCSlidingTabIndicatorFoundation;

			return new Foundation({
					addClass: (...props) => doChange(() => addClass(...props)),
					removeClass: (...props) => doChange(() => removeClass(...props)),
					computeContentClientRect,
					setContentStyleProperty: (...props) => doChange(() => addContentStyle(...props))
				});
		}

		function doChange(fn) {
			if (changeSets.length) {
				changeSets[changeSets.length - 1].push(fn);
			} else {
				fn();
			}
		}

		function addClass(className) {
			if (!internalClasses[className]) {
				$$invalidate(9, internalClasses[className] = true, internalClasses);
			}
		}

		function removeClass(className) {
			if (!(className in internalClasses) || internalClasses[className]) {
				$$invalidate(9, internalClasses[className] = false, internalClasses);
			}
		}

		function addContentStyle(name, value) {
			if (contentStyles[name] != value) {
				if (value === '' || value == null) {
					delete contentStyles[name];
					((($$invalidate(10, contentStyles), $$invalidate(19, oldTransition)), $$invalidate(4, transition)), $$invalidate(17, instance));
				} else {
					$$invalidate(10, contentStyles[name] = value, contentStyles);
				}
			}
		}

		function activate(previousIndicatorClientRect) {
			$$invalidate(0, active = true);
			instance.activate(previousIndicatorClientRect);
		}

		function deactivate() {
			$$invalidate(0, active = false);
			instance.deactivate();
		}

		function computeContentClientRect() {
			changeSets.push([]);
			$$invalidate(18, changeSets);
			return content.getBoundingClientRect();
		}

		function getElement() {
			return element;
		}

		function span0_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				content = $$value;
				$$invalidate(8, content);
			});
		}

		function span1_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				element = $$value;
				$$invalidate(7, element);
			});
		}

		$$self.$$set = $$new_props => {
			$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
			$$invalidate(12, $$restProps = compute_rest_props($$props, omit_props_names));
			if ('use' in $$new_props) $$invalidate(1, use = $$new_props.use);
			if ('class' in $$new_props) $$invalidate(2, className = $$new_props.class);
			if ('active' in $$new_props) $$invalidate(0, active = $$new_props.active);
			if ('type' in $$new_props) $$invalidate(3, type = $$new_props.type);
			if ('transition' in $$new_props) $$invalidate(4, transition = $$new_props.transition);
			if ('content$use' in $$new_props) $$invalidate(5, content$use = $$new_props.content$use);
			if ('content$class' in $$new_props) $$invalidate(6, content$class = $$new_props.content$class);
			if ('$$scope' in $$new_props) $$invalidate(20, $$scope = $$new_props.$$scope);
		};

		$$self.$$.update = () => {
			if ($$self.$$.dirty & /*oldTransition, transition, instance*/ 655376) {
				if (oldTransition !== transition) {
					$$invalidate(19, oldTransition = transition);
					instance && instance.destroy();
					$$invalidate(9, internalClasses = {});
					$$invalidate(10, contentStyles = {});
					$$invalidate(17, instance = getInstance());
					instance.init();
				}
			}

			if ($$self.$$.dirty & /*changeSets*/ 262144) {
				// Use sets of changes for DOM updates, to facilitate animations.
				if (changeSets.length) {
					requestAnimationFrame(() => {
						var _a;

						const changeSet = (_a = changeSets.shift()) !== null && _a !== void 0
						? _a
						: [];

						$$invalidate(18, changeSets);

						for (const fn of changeSet) {
							fn();
						}
					});
				}
			}
		};

		return [
			active,
			use,
			className,
			type,
			transition,
			content$use,
			content$class,
			element,
			content,
			internalClasses,
			contentStyles,
			forwardEvents,
			$$restProps,
			activate,
			deactivate,
			computeContentClientRect,
			getElement,
			instance,
			changeSets,
			oldTransition,
			$$scope,
			slots,
			span0_binding,
			span1_binding
		];
	}

	class TabIndicator extends SvelteComponent {
		constructor(options) {
			super();

			init(this, options, instance_1$7, create_fragment$e, safe_not_equal, {
				use: 1,
				class: 2,
				active: 0,
				type: 3,
				transition: 4,
				content$use: 5,
				content$class: 6,
				activate: 13,
				deactivate: 14,
				computeContentClientRect: 15,
				getElement: 16
			});
		}

		get activate() {
			return this.$$.ctx[13];
		}

		get deactivate() {
			return this.$$.ctx[14];
		}

		get computeContentClientRect() {
			return this.$$.ctx[15];
		}

		get getElement() {
			return this.$$.ctx[16];
		}
	}

	/* node_modules/@smui/tab/dist/Tab.svelte generated by Svelte v4.2.7 */
	const get_tab_indicator_slot_changes_1 = dirty => ({});
	const get_tab_indicator_slot_context_1 = ctx => ({});
	const get_tab_indicator_slot_changes = dirty => ({});
	const get_tab_indicator_slot_context = ctx => ({});

	// (49:4) {#if indicatorSpanOnlyContent}
	function create_if_block_1$3(ctx) {
		let tabindicator;
		let current;

		const tabindicator_spread_levels = [
			{ active: /*active*/ ctx[18] },
			prefixFilter(/*$$restProps*/ ctx[25], 'tabIndicator$')
		];

		let tabindicator_props = {
			$$slots: { default: [create_default_slot_2$2] },
			$$scope: { ctx }
		};

		for (let i = 0; i < tabindicator_spread_levels.length; i += 1) {
			tabindicator_props = assign(tabindicator_props, tabindicator_spread_levels[i]);
		}

		tabindicator = new TabIndicator({ props: tabindicator_props });
		/*tabindicator_binding*/ ctx[33](tabindicator);

		return {
			c() {
				create_component(tabindicator.$$.fragment);
			},
			m(target, anchor) {
				mount_component(tabindicator, target, anchor);
				current = true;
			},
			p(ctx, dirty) {
				const tabindicator_changes = (dirty[0] & /*active, $$restProps*/ 33816576)
				? get_spread_update(tabindicator_spread_levels, [
						dirty[0] & /*active*/ 262144 && { active: /*active*/ ctx[18] },
						dirty[0] & /*$$restProps*/ 33554432 && get_spread_object(prefixFilter(/*$$restProps*/ ctx[25], 'tabIndicator$'))
					])
				: {};

				if (dirty[1] & /*$$scope*/ 64) {
					tabindicator_changes.$$scope = { dirty, ctx };
				}

				tabindicator.$set(tabindicator_changes);
			},
			i(local) {
				if (current) return;
				transition_in(tabindicator.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(tabindicator.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				/*tabindicator_binding*/ ctx[33](null);
				destroy_component(tabindicator, detaching);
			}
		};
	}

	// (50:6) <TabIndicator         bind:this={tabIndicator}         {active}         {...prefixFilter($$restProps, 'tabIndicator$')}         >
	function create_default_slot_2$2(ctx) {
		let current;
		const tab_indicator_slot_template = /*#slots*/ ctx[32]["tab-indicator"];
		const tab_indicator_slot = create_slot(tab_indicator_slot_template, ctx, /*$$scope*/ ctx[37], get_tab_indicator_slot_context);

		return {
			c() {
				if (tab_indicator_slot) tab_indicator_slot.c();
			},
			m(target, anchor) {
				if (tab_indicator_slot) {
					tab_indicator_slot.m(target, anchor);
				}

				current = true;
			},
			p(ctx, dirty) {
				if (tab_indicator_slot) {
					if (tab_indicator_slot.p && (!current || dirty[1] & /*$$scope*/ 64)) {
						update_slot_base(
							tab_indicator_slot,
							tab_indicator_slot_template,
							ctx,
							/*$$scope*/ ctx[37],
							!current
							? get_all_dirty_from_scope(/*$$scope*/ ctx[37])
							: get_slot_changes(tab_indicator_slot_template, /*$$scope*/ ctx[37], dirty, get_tab_indicator_slot_changes),
							get_tab_indicator_slot_context
						);
					}
				}
			},
			i(local) {
				if (current) return;
				transition_in(tab_indicator_slot, local);
				current = true;
			},
			o(local) {
				transition_out(tab_indicator_slot, local);
				current = false;
			},
			d(detaching) {
				if (tab_indicator_slot) tab_indicator_slot.d(detaching);
			}
		};
	}

	// (58:2) {#if !indicatorSpanOnlyContent}
	function create_if_block$4(ctx) {
		let tabindicator;
		let current;

		const tabindicator_spread_levels = [
			{ active: /*active*/ ctx[18] },
			prefixFilter(/*$$restProps*/ ctx[25], 'tabIndicator$')
		];

		let tabindicator_props = {
			$$slots: { default: [create_default_slot_1$3] },
			$$scope: { ctx }
		};

		for (let i = 0; i < tabindicator_spread_levels.length; i += 1) {
			tabindicator_props = assign(tabindicator_props, tabindicator_spread_levels[i]);
		}

		tabindicator = new TabIndicator({ props: tabindicator_props });
		/*tabindicator_binding_1*/ ctx[35](tabindicator);

		return {
			c() {
				create_component(tabindicator.$$.fragment);
			},
			m(target, anchor) {
				mount_component(tabindicator, target, anchor);
				current = true;
			},
			p(ctx, dirty) {
				const tabindicator_changes = (dirty[0] & /*active, $$restProps*/ 33816576)
				? get_spread_update(tabindicator_spread_levels, [
						dirty[0] & /*active*/ 262144 && { active: /*active*/ ctx[18] },
						dirty[0] & /*$$restProps*/ 33554432 && get_spread_object(prefixFilter(/*$$restProps*/ ctx[25], 'tabIndicator$'))
					])
				: {};

				if (dirty[1] & /*$$scope*/ 64) {
					tabindicator_changes.$$scope = { dirty, ctx };
				}

				tabindicator.$set(tabindicator_changes);
			},
			i(local) {
				if (current) return;
				transition_in(tabindicator.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(tabindicator.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				/*tabindicator_binding_1*/ ctx[35](null);
				destroy_component(tabindicator, detaching);
			}
		};
	}

	// (59:4) <TabIndicator       bind:this={tabIndicator}       {active}       {...prefixFilter($$restProps, 'tabIndicator$')}       >
	function create_default_slot_1$3(ctx) {
		let current;
		const tab_indicator_slot_template = /*#slots*/ ctx[32]["tab-indicator"];
		const tab_indicator_slot = create_slot(tab_indicator_slot_template, ctx, /*$$scope*/ ctx[37], get_tab_indicator_slot_context_1);

		return {
			c() {
				if (tab_indicator_slot) tab_indicator_slot.c();
			},
			m(target, anchor) {
				if (tab_indicator_slot) {
					tab_indicator_slot.m(target, anchor);
				}

				current = true;
			},
			p(ctx, dirty) {
				if (tab_indicator_slot) {
					if (tab_indicator_slot.p && (!current || dirty[1] & /*$$scope*/ 64)) {
						update_slot_base(
							tab_indicator_slot,
							tab_indicator_slot_template,
							ctx,
							/*$$scope*/ ctx[37],
							!current
							? get_all_dirty_from_scope(/*$$scope*/ ctx[37])
							: get_slot_changes(tab_indicator_slot_template, /*$$scope*/ ctx[37], dirty, get_tab_indicator_slot_changes_1),
							get_tab_indicator_slot_context_1
						);
					}
				}
			},
			i(local) {
				if (current) return;
				transition_in(tab_indicator_slot, local);
				current = true;
			},
			o(local) {
				transition_out(tab_indicator_slot, local);
				current = false;
			},
			d(detaching) {
				if (tab_indicator_slot) tab_indicator_slot.d(detaching);
			}
		};
	}

	// (1:0) <svelte:component   this={component}   {tag}   bind:this={element}   use={[     [       Ripple,       {         ripple,         unbounded: false,         addClass,         removeClass,         addStyle,       },     ],     forwardEvents,     ...use,   ]}   class={classMap({     [className]: true,     'mdc-tab': true,     'mdc-tab--active': active,     'mdc-tab--stacked': stacked,     'mdc-tab--min-width': minWidth,     ...internalClasses,   })}   style={Object.entries(internalStyles)     .map(([name, value]) => `${name}: ${value};`)     .concat([style])     .join(' ')}   role="tab"   aria-selected={active ? 'true' : 'false'}   tabindex={active || forceAccessible ? '0' : '-1'}   {href}   on:click={handleClick}   {...internalAttrs}   {...exclude($$restProps, ['content$', 'tabIndicator$'])} >
	function create_default_slot$6(ctx) {
		let span0;
		let t0;
		let span0_class_value;
		let useActions_action;
		let t1;
		let t2;
		let span1;
		let current;
		let mounted;
		let dispose;
		const default_slot_template = /*#slots*/ ctx[32].default;
		const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[37], null);
		let if_block0 = /*indicatorSpanOnlyContent*/ ctx[6] && create_if_block_1$3(ctx);

		let span0_levels = [
			{
				class: span0_class_value = classMap({
					[/*content$class*/ ctx[9]]: true,
					'mdc-tab__content': true
				})
			},
			prefixFilter(/*$$restProps*/ ctx[25], 'content$')
		];

		let span_data_1 = {};

		for (let i = 0; i < span0_levels.length; i += 1) {
			span_data_1 = assign(span_data_1, span0_levels[i]);
		}

		let if_block1 = !/*indicatorSpanOnlyContent*/ ctx[6] && create_if_block$4(ctx);

		return {
			c() {
				span0 = element("span");
				if (default_slot) default_slot.c();
				t0 = space();
				if (if_block0) if_block0.c();
				t1 = space();
				if (if_block1) if_block1.c();
				t2 = space();
				span1 = element("span");
				set_attributes(span0, span_data_1);
				attr(span1, "class", "mdc-tab__ripple");
			},
			m(target, anchor) {
				insert(target, span0, anchor);

				if (default_slot) {
					default_slot.m(span0, null);
				}

				append(span0, t0);
				if (if_block0) if_block0.m(span0, null);
				/*span0_binding*/ ctx[34](span0);
				insert(target, t1, anchor);
				if (if_block1) if_block1.m(target, anchor);
				insert(target, t2, anchor);
				insert(target, span1, anchor);
				current = true;

				if (!mounted) {
					dispose = action_destroyer(useActions_action = useActions.call(null, span0, /*content$use*/ ctx[8]));
					mounted = true;
				}
			},
			p(ctx, dirty) {
				if (default_slot) {
					if (default_slot.p && (!current || dirty[1] & /*$$scope*/ 64)) {
						update_slot_base(
							default_slot,
							default_slot_template,
							ctx,
							/*$$scope*/ ctx[37],
							!current
							? get_all_dirty_from_scope(/*$$scope*/ ctx[37])
							: get_slot_changes(default_slot_template, /*$$scope*/ ctx[37], dirty, null),
							null
						);
					}
				}

				if (/*indicatorSpanOnlyContent*/ ctx[6]) {
					if (if_block0) {
						if_block0.p(ctx, dirty);

						if (dirty[0] & /*indicatorSpanOnlyContent*/ 64) {
							transition_in(if_block0, 1);
						}
					} else {
						if_block0 = create_if_block_1$3(ctx);
						if_block0.c();
						transition_in(if_block0, 1);
						if_block0.m(span0, null);
					}
				} else if (if_block0) {
					group_outros();

					transition_out(if_block0, 1, 1, () => {
						if_block0 = null;
					});

					check_outros();
				}

				set_attributes(span0, span_data_1 = get_spread_update(span0_levels, [
					(!current || dirty[0] & /*content$class*/ 512 && span0_class_value !== (span0_class_value = classMap({
						[/*content$class*/ ctx[9]]: true,
						'mdc-tab__content': true
					}))) && { class: span0_class_value },
					dirty[0] & /*$$restProps*/ 33554432 && prefixFilter(/*$$restProps*/ ctx[25], 'content$')
				]));

				if (useActions_action && is_function(useActions_action.update) && dirty[0] & /*content$use*/ 256) useActions_action.update.call(null, /*content$use*/ ctx[8]);

				if (!/*indicatorSpanOnlyContent*/ ctx[6]) {
					if (if_block1) {
						if_block1.p(ctx, dirty);

						if (dirty[0] & /*indicatorSpanOnlyContent*/ 64) {
							transition_in(if_block1, 1);
						}
					} else {
						if_block1 = create_if_block$4(ctx);
						if_block1.c();
						transition_in(if_block1, 1);
						if_block1.m(t2.parentNode, t2);
					}
				} else if (if_block1) {
					group_outros();

					transition_out(if_block1, 1, 1, () => {
						if_block1 = null;
					});

					check_outros();
				}
			},
			i(local) {
				if (current) return;
				transition_in(default_slot, local);
				transition_in(if_block0);
				transition_in(if_block1);
				current = true;
			},
			o(local) {
				transition_out(default_slot, local);
				transition_out(if_block0);
				transition_out(if_block1);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(span0);
					detach(t1);
					detach(t2);
					detach(span1);
				}

				if (default_slot) default_slot.d(detaching);
				if (if_block0) if_block0.d();
				/*span0_binding*/ ctx[34](null);
				if (if_block1) if_block1.d(detaching);
				mounted = false;
				dispose();
			}
		};
	}

	function create_fragment$d(ctx) {
		let switch_instance;
		let switch_instance_anchor;
		let current;

		const switch_instance_spread_levels = [
			{ tag: /*tag*/ ctx[11] },
			{
				use: [
					[
						Ripple,
						{
							ripple: /*ripple*/ ctx[3],
							unbounded: false,
							addClass: /*addClass*/ ctx[21],
							removeClass: /*removeClass*/ ctx[22],
							addStyle: /*addStyle*/ ctx[23]
						}
					],
					/*forwardEvents*/ ctx[20],
					.../*use*/ ctx[0]
				]
			},
			{
				class: classMap({
					[/*className*/ ctx[1]]: true,
					'mdc-tab': true,
					'mdc-tab--active': /*active*/ ctx[18],
					'mdc-tab--stacked': /*stacked*/ ctx[4],
					'mdc-tab--min-width': /*minWidth*/ ctx[5],
					.../*internalClasses*/ ctx[15]
				})
			},
			{
				style: Object.entries(/*internalStyles*/ ctx[16]).map(func$4).concat([/*style*/ ctx[2]]).join(' ')
			},
			{ role: "tab" },
			{
				"aria-selected": /*active*/ ctx[18] ? 'true' : 'false'
			},
			{
				tabindex: /*active*/ ctx[18] || /*forceAccessible*/ ctx[19]
				? '0'
				: '-1'
			},
			{ href: /*href*/ ctx[7] },
			/*internalAttrs*/ ctx[17],
			exclude(/*$$restProps*/ ctx[25], ['content$', 'tabIndicator$'])
		];

		var switch_value = /*component*/ ctx[10];

		function switch_props(ctx, dirty) {
			let switch_instance_props = {
				$$slots: { default: [create_default_slot$6] },
				$$scope: { ctx }
			};

			if (dirty !== undefined && dirty[0] & /*tag, ripple, addClass, removeClass, addStyle, forwardEvents, use, className, active, stacked, minWidth, internalClasses, internalStyles, style, forceAccessible, href, internalAttrs, $$restProps*/ 50301119) {
				switch_instance_props = get_spread_update(switch_instance_spread_levels, [
					dirty[0] & /*tag*/ 2048 && { tag: /*tag*/ ctx[11] },
					dirty[0] & /*ripple, addClass, removeClass, addStyle, forwardEvents, use*/ 15728649 && {
						use: [
							[
								Ripple,
								{
									ripple: /*ripple*/ ctx[3],
									unbounded: false,
									addClass: /*addClass*/ ctx[21],
									removeClass: /*removeClass*/ ctx[22],
									addStyle: /*addStyle*/ ctx[23]
								}
							],
							/*forwardEvents*/ ctx[20],
							.../*use*/ ctx[0]
						]
					},
					dirty[0] & /*className, active, stacked, minWidth, internalClasses*/ 294962 && {
						class: classMap({
							[/*className*/ ctx[1]]: true,
							'mdc-tab': true,
							'mdc-tab--active': /*active*/ ctx[18],
							'mdc-tab--stacked': /*stacked*/ ctx[4],
							'mdc-tab--min-width': /*minWidth*/ ctx[5],
							.../*internalClasses*/ ctx[15]
						})
					},
					dirty[0] & /*internalStyles, style*/ 65540 && {
						style: Object.entries(/*internalStyles*/ ctx[16]).map(func$4).concat([/*style*/ ctx[2]]).join(' ')
					},
					switch_instance_spread_levels[4],
					dirty[0] & /*active*/ 262144 && {
						"aria-selected": /*active*/ ctx[18] ? 'true' : 'false'
					},
					dirty[0] & /*active, forceAccessible*/ 786432 && {
						tabindex: /*active*/ ctx[18] || /*forceAccessible*/ ctx[19]
						? '0'
						: '-1'
					},
					dirty[0] & /*href*/ 128 && { href: /*href*/ ctx[7] },
					dirty[0] & /*internalAttrs*/ 131072 && get_spread_object(/*internalAttrs*/ ctx[17]),
					dirty[0] & /*$$restProps*/ 33554432 && get_spread_object(exclude(/*$$restProps*/ ctx[25], ['content$', 'tabIndicator$']))
				]);
			} else {
				for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
					switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
				}
			}

			return { props: switch_instance_props };
		}

		if (switch_value) {
			switch_instance = construct_svelte_component(switch_value, switch_props(ctx));
			/*switch_instance_binding*/ ctx[36](switch_instance);
			switch_instance.$on("click", /*handleClick*/ ctx[24]);
		}

		return {
			c() {
				if (switch_instance) create_component(switch_instance.$$.fragment);
				switch_instance_anchor = empty();
			},
			m(target, anchor) {
				if (switch_instance) mount_component(switch_instance, target, anchor);
				insert(target, switch_instance_anchor, anchor);
				current = true;
			},
			p(ctx, dirty) {
				if (dirty[0] & /*component*/ 1024 && switch_value !== (switch_value = /*component*/ ctx[10])) {
					if (switch_instance) {
						group_outros();
						const old_component = switch_instance;

						transition_out(old_component.$$.fragment, 1, 0, () => {
							destroy_component(old_component, 1);
						});

						check_outros();
					}

					if (switch_value) {
						switch_instance = construct_svelte_component(switch_value, switch_props(ctx, dirty));
						/*switch_instance_binding*/ ctx[36](switch_instance);
						switch_instance.$on("click", /*handleClick*/ ctx[24]);
						create_component(switch_instance.$$.fragment);
						transition_in(switch_instance.$$.fragment, 1);
						mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
					} else {
						switch_instance = null;
					}
				} else if (switch_value) {
					const switch_instance_changes = (dirty[0] & /*tag, ripple, addClass, removeClass, addStyle, forwardEvents, use, className, active, stacked, minWidth, internalClasses, internalStyles, style, forceAccessible, href, internalAttrs, $$restProps*/ 50301119)
					? get_spread_update(switch_instance_spread_levels, [
							dirty[0] & /*tag*/ 2048 && { tag: /*tag*/ ctx[11] },
							dirty[0] & /*ripple, addClass, removeClass, addStyle, forwardEvents, use*/ 15728649 && {
								use: [
									[
										Ripple,
										{
											ripple: /*ripple*/ ctx[3],
											unbounded: false,
											addClass: /*addClass*/ ctx[21],
											removeClass: /*removeClass*/ ctx[22],
											addStyle: /*addStyle*/ ctx[23]
										}
									],
									/*forwardEvents*/ ctx[20],
									.../*use*/ ctx[0]
								]
							},
							dirty[0] & /*className, active, stacked, minWidth, internalClasses*/ 294962 && {
								class: classMap({
									[/*className*/ ctx[1]]: true,
									'mdc-tab': true,
									'mdc-tab--active': /*active*/ ctx[18],
									'mdc-tab--stacked': /*stacked*/ ctx[4],
									'mdc-tab--min-width': /*minWidth*/ ctx[5],
									.../*internalClasses*/ ctx[15]
								})
							},
							dirty[0] & /*internalStyles, style*/ 65540 && {
								style: Object.entries(/*internalStyles*/ ctx[16]).map(func$4).concat([/*style*/ ctx[2]]).join(' ')
							},
							switch_instance_spread_levels[4],
							dirty[0] & /*active*/ 262144 && {
								"aria-selected": /*active*/ ctx[18] ? 'true' : 'false'
							},
							dirty[0] & /*active, forceAccessible*/ 786432 && {
								tabindex: /*active*/ ctx[18] || /*forceAccessible*/ ctx[19]
								? '0'
								: '-1'
							},
							dirty[0] & /*href*/ 128 && { href: /*href*/ ctx[7] },
							dirty[0] & /*internalAttrs*/ 131072 && get_spread_object(/*internalAttrs*/ ctx[17]),
							dirty[0] & /*$$restProps*/ 33554432 && get_spread_object(exclude(/*$$restProps*/ ctx[25], ['content$', 'tabIndicator$']))
						])
					: {};

					if (dirty[0] & /*active, $$restProps, tabIndicator, indicatorSpanOnlyContent, content$class, content, content$use*/ 33841984 | dirty[1] & /*$$scope*/ 64) {
						switch_instance_changes.$$scope = { dirty, ctx };
					}

					switch_instance.$set(switch_instance_changes);
				}
			},
			i(local) {
				if (current) return;
				if (switch_instance) transition_in(switch_instance.$$.fragment, local);
				current = true;
			},
			o(local) {
				if (switch_instance) transition_out(switch_instance.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(switch_instance_anchor);
				}

				/*switch_instance_binding*/ ctx[36](null);
				if (switch_instance) destroy_component(switch_instance, detaching);
			}
		};
	}

	const func$4 = ([name, value]) => `${name}: ${value};`;

	function instance_1$6($$self, $$props, $$invalidate) {
		const omit_props_names = [
			"use","class","style","tab","ripple","stacked","minWidth","indicatorSpanOnlyContent","href","content$use","content$class","component","tag","activate","deactivate","focus","getElement"
		];

		let $$restProps = compute_rest_props($$props, omit_props_names);
		let { $$slots: slots = {}, $$scope } = $$props;
		const forwardEvents = forwardEventsBuilder(get_current_component());
		let { use = [] } = $$props;
		let { class: className = '' } = $$props;
		let { style = '' } = $$props;
		let { tab: tabId } = $$props;
		let { ripple = true } = $$props;
		let { stacked = false } = $$props;
		let { minWidth = false } = $$props;
		let { indicatorSpanOnlyContent = false } = $$props;
		let { href = undefined } = $$props;
		let { content$use = [] } = $$props;
		let { content$class = '' } = $$props;
		let element;
		let instance;
		let content;
		let tabIndicator;
		let internalClasses = {};
		let internalStyles = {};
		let internalAttrs = {};
		let focusOnActivate = getContext('SMUI:tab:focusOnActivate');
		let active = tabId === getContext('SMUI:tab:initialActive');
		let forceAccessible = false;
		let { component = SmuiElement } = $$props;

		let { tag = component === SmuiElement
		? href == null ? 'button' : 'a'
		: undefined } = $$props;

		setContext('SMUI:label:context', 'tab');
		setContext('SMUI:icon:context', 'tab');

		if (!tabId) {
			throw new Error('The tab property is required! It should be passed down from the TabBar to the Tab.');
		}

		onMount(() => {
			$$invalidate(31, instance = new MDCTabFoundation({
					setAttr: addAttr,
					addClass,
					removeClass,
					hasClass,
					activateIndicator: previousIndicatorClientRect => tabIndicator.activate(previousIndicatorClientRect),
					deactivateIndicator: () => tabIndicator.deactivate(),
					notifyInteracted: () => dispatch(getElement(), 'SMUITab:interacted', { tabId }, undefined, true),
					getOffsetLeft: () => getElement().offsetLeft,
					getOffsetWidth: () => getElement().offsetWidth,
					getContentOffsetLeft: () => content.offsetLeft,
					getContentOffsetWidth: () => content.offsetWidth,
					focus
				}));

			const accessor = {
				tabId,
				get element() {
					return getElement();
				},
				get active() {
					return active;
				},
				forceAccessible(accessible) {
					$$invalidate(19, forceAccessible = accessible);
				},
				computeIndicatorClientRect: () => tabIndicator.computeContentClientRect(),
				computeDimensions: () => instance.computeDimensions(),
				focus,
				activate,
				deactivate
			};

			dispatch(getElement(), 'SMUITab:mount', accessor);
			instance.init();

			return () => {
				dispatch(getElement(), 'SMUITab:unmount', accessor);
				instance.destroy();
			};
		});

		function hasClass(className) {
			return className in internalClasses
			? internalClasses[className]
			: getElement().classList.contains(className);
		}

		function addClass(className) {
			if (!internalClasses[className]) {
				$$invalidate(15, internalClasses[className] = true, internalClasses);
			}
		}

		function removeClass(className) {
			if (!(className in internalClasses) || internalClasses[className]) {
				$$invalidate(15, internalClasses[className] = false, internalClasses);
			}
		}

		function addStyle(name, value) {
			if (internalStyles[name] != value) {
				if (value === '' || value == null) {
					delete internalStyles[name];
					$$invalidate(16, internalStyles);
				} else {
					$$invalidate(16, internalStyles[name] = value, internalStyles);
				}
			}
		}

		function addAttr(name, value) {
			if (internalAttrs[name] !== value) {
				$$invalidate(17, internalAttrs[name] = value, internalAttrs);
			}
		}

		function handleClick(event) {
			if (!event.defaultPrevented && instance) {
				instance.handleClick();
			}
		}

		function activate(previousIndicatorClientRect, skipFocus) {
			$$invalidate(18, active = true);

			if (skipFocus) {
				instance.setFocusOnActivate(false);
			}

			instance.activate(previousIndicatorClientRect);

			if (skipFocus) {
				instance.setFocusOnActivate(focusOnActivate);
			}
		}

		function deactivate() {
			$$invalidate(18, active = false);
			instance.deactivate();
		}

		function focus() {
			getElement().focus();
		}

		function getElement() {
			return element.getElement();
		}

		function tabindicator_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				tabIndicator = $$value;
				$$invalidate(14, tabIndicator);
			});
		}

		function span0_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				content = $$value;
				$$invalidate(13, content);
			});
		}

		function tabindicator_binding_1($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				tabIndicator = $$value;
				$$invalidate(14, tabIndicator);
			});
		}

		function switch_instance_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				element = $$value;
				$$invalidate(12, element);
			});
		}

		$$self.$$set = $$new_props => {
			$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
			$$invalidate(25, $$restProps = compute_rest_props($$props, omit_props_names));
			if ('use' in $$new_props) $$invalidate(0, use = $$new_props.use);
			if ('class' in $$new_props) $$invalidate(1, className = $$new_props.class);
			if ('style' in $$new_props) $$invalidate(2, style = $$new_props.style);
			if ('tab' in $$new_props) $$invalidate(26, tabId = $$new_props.tab);
			if ('ripple' in $$new_props) $$invalidate(3, ripple = $$new_props.ripple);
			if ('stacked' in $$new_props) $$invalidate(4, stacked = $$new_props.stacked);
			if ('minWidth' in $$new_props) $$invalidate(5, minWidth = $$new_props.minWidth);
			if ('indicatorSpanOnlyContent' in $$new_props) $$invalidate(6, indicatorSpanOnlyContent = $$new_props.indicatorSpanOnlyContent);
			if ('href' in $$new_props) $$invalidate(7, href = $$new_props.href);
			if ('content$use' in $$new_props) $$invalidate(8, content$use = $$new_props.content$use);
			if ('content$class' in $$new_props) $$invalidate(9, content$class = $$new_props.content$class);
			if ('component' in $$new_props) $$invalidate(10, component = $$new_props.component);
			if ('tag' in $$new_props) $$invalidate(11, tag = $$new_props.tag);
			if ('$$scope' in $$new_props) $$invalidate(37, $$scope = $$new_props.$$scope);
		};

		$$self.$$.update = () => {
			if ($$self.$$.dirty[1] & /*instance*/ 1) {
				if (instance) {
					instance.setFocusOnActivate(focusOnActivate);
				}
			}
		};

		return [
			use,
			className,
			style,
			ripple,
			stacked,
			minWidth,
			indicatorSpanOnlyContent,
			href,
			content$use,
			content$class,
			component,
			tag,
			element,
			content,
			tabIndicator,
			internalClasses,
			internalStyles,
			internalAttrs,
			active,
			forceAccessible,
			forwardEvents,
			addClass,
			removeClass,
			addStyle,
			handleClick,
			$$restProps,
			tabId,
			activate,
			deactivate,
			focus,
			getElement,
			instance,
			slots,
			tabindicator_binding,
			span0_binding,
			tabindicator_binding_1,
			switch_instance_binding,
			$$scope
		];
	}

	class Tab extends SvelteComponent {
		constructor(options) {
			super();

			init(
				this,
				options,
				instance_1$6,
				create_fragment$d,
				safe_not_equal,
				{
					use: 0,
					class: 1,
					style: 2,
					tab: 26,
					ripple: 3,
					stacked: 4,
					minWidth: 5,
					indicatorSpanOnlyContent: 6,
					href: 7,
					content$use: 8,
					content$class: 9,
					component: 10,
					tag: 11,
					activate: 27,
					deactivate: 28,
					focus: 29,
					getElement: 30
				},
				null,
				[-1, -1]
			);
		}

		get activate() {
			return this.$$.ctx[27];
		}

		get deactivate() {
			return this.$$.ctx[28];
		}

		get focus() {
			return this.$$.ctx[29];
		}

		get getElement() {
			return this.$$.ctx[30];
		}
	}

	/**
	 * @license
	 * Copyright 2018 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */
	var cssClasses$4 = {
	    ANIMATING: 'mdc-tab-scroller--animating',
	    SCROLL_AREA_SCROLL: 'mdc-tab-scroller__scroll-area--scroll',
	    SCROLL_TEST: 'mdc-tab-scroller__test',
	};
	var strings$6 = {
	    AREA_SELECTOR: '.mdc-tab-scroller__scroll-area',
	    CONTENT_SELECTOR: '.mdc-tab-scroller__scroll-content',
	};

	/**
	 * @license
	 * Copyright 2018 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */
	var MDCTabScrollerRTL = /** @class */ (function () {
	    function MDCTabScrollerRTL(adapter) {
	        this.adapter = adapter;
	    }
	    return MDCTabScrollerRTL;
	}());

	/**
	 * @license
	 * Copyright 2018 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */
	var MDCTabScrollerRTLDefault = /** @class */ (function (_super) {
	    __extends(MDCTabScrollerRTLDefault, _super);
	    function MDCTabScrollerRTLDefault() {
	        return _super !== null && _super.apply(this, arguments) || this;
	    }
	    MDCTabScrollerRTLDefault.prototype.getScrollPositionRTL = function () {
	        var currentScrollLeft = this.adapter.getScrollAreaScrollLeft();
	        var right = this.calculateScrollEdges().right;
	        // Scroll values on most browsers are ints instead of floats so we round
	        return Math.round(right - currentScrollLeft);
	    };
	    MDCTabScrollerRTLDefault.prototype.scrollToRTL = function (scrollX) {
	        var edges = this.calculateScrollEdges();
	        var currentScrollLeft = this.adapter.getScrollAreaScrollLeft();
	        var clampedScrollLeft = this.clampScrollValue(edges.right - scrollX);
	        return {
	            finalScrollPosition: clampedScrollLeft,
	            scrollDelta: clampedScrollLeft - currentScrollLeft,
	        };
	    };
	    MDCTabScrollerRTLDefault.prototype.incrementScrollRTL = function (scrollX) {
	        var currentScrollLeft = this.adapter.getScrollAreaScrollLeft();
	        var clampedScrollLeft = this.clampScrollValue(currentScrollLeft - scrollX);
	        return {
	            finalScrollPosition: clampedScrollLeft,
	            scrollDelta: clampedScrollLeft - currentScrollLeft,
	        };
	    };
	    MDCTabScrollerRTLDefault.prototype.getAnimatingScrollPosition = function (scrollX) {
	        return scrollX;
	    };
	    MDCTabScrollerRTLDefault.prototype.calculateScrollEdges = function () {
	        var contentWidth = this.adapter.getScrollContentOffsetWidth();
	        var rootWidth = this.adapter.getScrollAreaOffsetWidth();
	        return {
	            left: 0,
	            right: contentWidth - rootWidth,
	        };
	    };
	    MDCTabScrollerRTLDefault.prototype.clampScrollValue = function (scrollX) {
	        var edges = this.calculateScrollEdges();
	        return Math.min(Math.max(edges.left, scrollX), edges.right);
	    };
	    return MDCTabScrollerRTLDefault;
	}(MDCTabScrollerRTL));

	/**
	 * @license
	 * Copyright 2018 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */
	var MDCTabScrollerRTLNegative = /** @class */ (function (_super) {
	    __extends(MDCTabScrollerRTLNegative, _super);
	    function MDCTabScrollerRTLNegative() {
	        return _super !== null && _super.apply(this, arguments) || this;
	    }
	    MDCTabScrollerRTLNegative.prototype.getScrollPositionRTL = function (translateX) {
	        var currentScrollLeft = this.adapter.getScrollAreaScrollLeft();
	        return Math.round(translateX - currentScrollLeft);
	    };
	    MDCTabScrollerRTLNegative.prototype.scrollToRTL = function (scrollX) {
	        var currentScrollLeft = this.adapter.getScrollAreaScrollLeft();
	        var clampedScrollLeft = this.clampScrollValue(-scrollX);
	        return {
	            finalScrollPosition: clampedScrollLeft,
	            scrollDelta: clampedScrollLeft - currentScrollLeft,
	        };
	    };
	    MDCTabScrollerRTLNegative.prototype.incrementScrollRTL = function (scrollX) {
	        var currentScrollLeft = this.adapter.getScrollAreaScrollLeft();
	        var clampedScrollLeft = this.clampScrollValue(currentScrollLeft - scrollX);
	        return {
	            finalScrollPosition: clampedScrollLeft,
	            scrollDelta: clampedScrollLeft - currentScrollLeft,
	        };
	    };
	    MDCTabScrollerRTLNegative.prototype.getAnimatingScrollPosition = function (scrollX, translateX) {
	        return scrollX - translateX;
	    };
	    MDCTabScrollerRTLNegative.prototype.calculateScrollEdges = function () {
	        var contentWidth = this.adapter.getScrollContentOffsetWidth();
	        var rootWidth = this.adapter.getScrollAreaOffsetWidth();
	        return {
	            left: rootWidth - contentWidth,
	            right: 0,
	        };
	    };
	    MDCTabScrollerRTLNegative.prototype.clampScrollValue = function (scrollX) {
	        var edges = this.calculateScrollEdges();
	        return Math.max(Math.min(edges.right, scrollX), edges.left);
	    };
	    return MDCTabScrollerRTLNegative;
	}(MDCTabScrollerRTL));

	/**
	 * @license
	 * Copyright 2018 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */
	var MDCTabScrollerRTLReverse = /** @class */ (function (_super) {
	    __extends(MDCTabScrollerRTLReverse, _super);
	    function MDCTabScrollerRTLReverse() {
	        return _super !== null && _super.apply(this, arguments) || this;
	    }
	    MDCTabScrollerRTLReverse.prototype.getScrollPositionRTL = function (translateX) {
	        var currentScrollLeft = this.adapter.getScrollAreaScrollLeft();
	        // Scroll values on most browsers are ints instead of floats so we round
	        return Math.round(currentScrollLeft - translateX);
	    };
	    MDCTabScrollerRTLReverse.prototype.scrollToRTL = function (scrollX) {
	        var currentScrollLeft = this.adapter.getScrollAreaScrollLeft();
	        var clampedScrollLeft = this.clampScrollValue(scrollX);
	        return {
	            finalScrollPosition: clampedScrollLeft,
	            scrollDelta: currentScrollLeft - clampedScrollLeft,
	        };
	    };
	    MDCTabScrollerRTLReverse.prototype.incrementScrollRTL = function (scrollX) {
	        var currentScrollLeft = this.adapter.getScrollAreaScrollLeft();
	        var clampedScrollLeft = this.clampScrollValue(currentScrollLeft + scrollX);
	        return {
	            finalScrollPosition: clampedScrollLeft,
	            scrollDelta: currentScrollLeft - clampedScrollLeft,
	        };
	    };
	    MDCTabScrollerRTLReverse.prototype.getAnimatingScrollPosition = function (scrollX, translateX) {
	        return scrollX + translateX;
	    };
	    MDCTabScrollerRTLReverse.prototype.calculateScrollEdges = function () {
	        var contentWidth = this.adapter.getScrollContentOffsetWidth();
	        var rootWidth = this.adapter.getScrollAreaOffsetWidth();
	        return {
	            left: contentWidth - rootWidth,
	            right: 0,
	        };
	    };
	    MDCTabScrollerRTLReverse.prototype.clampScrollValue = function (scrollX) {
	        var edges = this.calculateScrollEdges();
	        return Math.min(Math.max(edges.right, scrollX), edges.left);
	    };
	    return MDCTabScrollerRTLReverse;
	}(MDCTabScrollerRTL));

	/**
	 * @license
	 * Copyright 2018 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */
	var MDCTabScrollerFoundation = /** @class */ (function (_super) {
	    __extends(MDCTabScrollerFoundation, _super);
	    function MDCTabScrollerFoundation(adapter) {
	        var _this = _super.call(this, __assign(__assign({}, MDCTabScrollerFoundation.defaultAdapter), adapter)) || this;
	        /**
	         * Controls whether we should handle the transitionend and interaction events during the animation.
	         */
	        _this.isAnimating = false;
	        return _this;
	    }
	    Object.defineProperty(MDCTabScrollerFoundation, "cssClasses", {
	        get: function () {
	            return cssClasses$4;
	        },
	        enumerable: false,
	        configurable: true
	    });
	    Object.defineProperty(MDCTabScrollerFoundation, "strings", {
	        get: function () {
	            return strings$6;
	        },
	        enumerable: false,
	        configurable: true
	    });
	    Object.defineProperty(MDCTabScrollerFoundation, "defaultAdapter", {
	        get: function () {
	            // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
	            return {
	                eventTargetMatchesSelector: function () { return false; },
	                addClass: function () { return undefined; },
	                removeClass: function () { return undefined; },
	                addScrollAreaClass: function () { return undefined; },
	                setScrollAreaStyleProperty: function () { return undefined; },
	                setScrollContentStyleProperty: function () { return undefined; },
	                getScrollContentStyleValue: function () { return ''; },
	                setScrollAreaScrollLeft: function () { return undefined; },
	                getScrollAreaScrollLeft: function () { return 0; },
	                getScrollContentOffsetWidth: function () { return 0; },
	                getScrollAreaOffsetWidth: function () { return 0; },
	                computeScrollAreaClientRect: function () {
	                    return ({ top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0 });
	                },
	                computeScrollContentClientRect: function () {
	                    return ({ top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0 });
	                },
	                computeHorizontalScrollbarHeight: function () { return 0; },
	            };
	            // tslint:enable:object-literal-sort-keys
	        },
	        enumerable: false,
	        configurable: true
	    });
	    MDCTabScrollerFoundation.prototype.init = function () {
	        // Compute horizontal scrollbar height on scroller with overflow initially hidden, then update overflow to scroll
	        // and immediately adjust bottom margin to avoid the scrollbar initially appearing before JS runs.
	        var horizontalScrollbarHeight = this.adapter.computeHorizontalScrollbarHeight();
	        this.adapter.setScrollAreaStyleProperty('margin-bottom', -horizontalScrollbarHeight + 'px');
	        this.adapter.addScrollAreaClass(MDCTabScrollerFoundation.cssClasses.SCROLL_AREA_SCROLL);
	    };
	    /**
	     * Computes the current visual scroll position
	     */
	    MDCTabScrollerFoundation.prototype.getScrollPosition = function () {
	        if (this.isRTL()) {
	            return this.computeCurrentScrollPositionRTL();
	        }
	        var currentTranslateX = this.calculateCurrentTranslateX();
	        var scrollLeft = this.adapter.getScrollAreaScrollLeft();
	        return scrollLeft - currentTranslateX;
	    };
	    /**
	     * Handles interaction events that occur during transition
	     */
	    MDCTabScrollerFoundation.prototype.handleInteraction = function () {
	        // Early exit if we aren't animating
	        if (!this.isAnimating) {
	            return;
	        }
	        // Prevent other event listeners from handling this event
	        this.stopScrollAnimation();
	    };
	    /**
	     * Handles the transitionend event
	     */
	    MDCTabScrollerFoundation.prototype.handleTransitionEnd = function (evt) {
	        // Early exit if we aren't animating or the event was triggered by a different element.
	        var evtTarget = evt.target;
	        if (!this.isAnimating ||
	            !this.adapter.eventTargetMatchesSelector(evtTarget, MDCTabScrollerFoundation.strings.CONTENT_SELECTOR)) {
	            return;
	        }
	        this.isAnimating = false;
	        this.adapter.removeClass(MDCTabScrollerFoundation.cssClasses.ANIMATING);
	    };
	    /**
	     * Increment the scroll value by the scrollXIncrement using animation.
	     * @param scrollXIncrement The value by which to increment the scroll position
	     */
	    MDCTabScrollerFoundation.prototype.incrementScroll = function (scrollXIncrement) {
	        // Early exit for non-operational increment values
	        if (scrollXIncrement === 0) {
	            return;
	        }
	        this.animate(this.getIncrementScrollOperation(scrollXIncrement));
	    };
	    /**
	     * Increment the scroll value by the scrollXIncrement without animation.
	     * @param scrollXIncrement The value by which to increment the scroll position
	     */
	    MDCTabScrollerFoundation.prototype.incrementScrollImmediate = function (scrollXIncrement) {
	        // Early exit for non-operational increment values
	        if (scrollXIncrement === 0) {
	            return;
	        }
	        var operation = this.getIncrementScrollOperation(scrollXIncrement);
	        if (operation.scrollDelta === 0) {
	            return;
	        }
	        this.stopScrollAnimation();
	        this.adapter.setScrollAreaScrollLeft(operation.finalScrollPosition);
	    };
	    /**
	     * Scrolls to the given scrollX value
	     */
	    MDCTabScrollerFoundation.prototype.scrollTo = function (scrollX) {
	        if (this.isRTL()) {
	            this.scrollToImplRTL(scrollX);
	            return;
	        }
	        this.scrollToImpl(scrollX);
	    };
	    /**
	     * @return Browser-specific {@link MDCTabScrollerRTL} instance.
	     */
	    MDCTabScrollerFoundation.prototype.getRTLScroller = function () {
	        if (!this.rtlScrollerInstance) {
	            this.rtlScrollerInstance = this.rtlScrollerFactory();
	        }
	        return this.rtlScrollerInstance;
	    };
	    /**
	     * @return translateX value from a CSS matrix transform function string.
	     */
	    MDCTabScrollerFoundation.prototype.calculateCurrentTranslateX = function () {
	        var transformValue = this.adapter.getScrollContentStyleValue('transform');
	        // Early exit if no transform is present
	        if (transformValue === 'none') {
	            return 0;
	        }
	        // The transform value comes back as a matrix transformation in the form
	        // of `matrix(a, b, c, d, tx, ty)`. We only care about tx (translateX) so
	        // we're going to grab all the parenthesized values, strip out tx, and
	        // parse it.
	        var match = /\((.+?)\)/.exec(transformValue);
	        if (!match) {
	            return 0;
	        }
	        var matrixParams = match[1];
	        // tslint:disable-next-line:ban-ts-ignore "Unused vars" should be a linter warning, not a compiler error.
	        // @ts-ignore These unused variables should retain their semantic names for clarity.
	        var _a = __read(matrixParams.split(','), 6); _a[0]; _a[1]; _a[2]; _a[3]; var tx = _a[4]; _a[5];
	        return parseFloat(tx); // tslint:disable-line:ban
	    };
	    /**
	     * Calculates a safe scroll value that is > 0 and < the max scroll value
	     * @param scrollX The distance to scroll
	     */
	    MDCTabScrollerFoundation.prototype.clampScrollValue = function (scrollX) {
	        var edges = this.calculateScrollEdges();
	        return Math.min(Math.max(edges.left, scrollX), edges.right);
	    };
	    MDCTabScrollerFoundation.prototype.computeCurrentScrollPositionRTL = function () {
	        var translateX = this.calculateCurrentTranslateX();
	        return this.getRTLScroller().getScrollPositionRTL(translateX);
	    };
	    MDCTabScrollerFoundation.prototype.calculateScrollEdges = function () {
	        var contentWidth = this.adapter.getScrollContentOffsetWidth();
	        var rootWidth = this.adapter.getScrollAreaOffsetWidth();
	        return {
	            left: 0,
	            right: contentWidth - rootWidth,
	        };
	    };
	    /**
	     * Internal scroll method
	     * @param scrollX The new scroll position
	     */
	    MDCTabScrollerFoundation.prototype.scrollToImpl = function (scrollX) {
	        var currentScrollX = this.getScrollPosition();
	        var safeScrollX = this.clampScrollValue(scrollX);
	        var scrollDelta = safeScrollX - currentScrollX;
	        this.animate({
	            finalScrollPosition: safeScrollX,
	            scrollDelta: scrollDelta,
	        });
	    };
	    /**
	     * Internal RTL scroll method
	     * @param scrollX The new scroll position
	     */
	    MDCTabScrollerFoundation.prototype.scrollToImplRTL = function (scrollX) {
	        var animation = this.getRTLScroller().scrollToRTL(scrollX);
	        this.animate(animation);
	    };
	    /**
	     * Internal method to compute the increment scroll operation values.
	     * @param scrollX The desired scroll position increment
	     * @return MDCTabScrollerAnimation with the sanitized values for performing the scroll operation.
	     */
	    MDCTabScrollerFoundation.prototype.getIncrementScrollOperation = function (scrollX) {
	        if (this.isRTL()) {
	            return this.getRTLScroller().incrementScrollRTL(scrollX);
	        }
	        var currentScrollX = this.getScrollPosition();
	        var targetScrollX = scrollX + currentScrollX;
	        var safeScrollX = this.clampScrollValue(targetScrollX);
	        var scrollDelta = safeScrollX - currentScrollX;
	        return {
	            finalScrollPosition: safeScrollX,
	            scrollDelta: scrollDelta,
	        };
	    };
	    /**
	     * Animates the tab scrolling
	     * @param animation The animation to apply
	     */
	    MDCTabScrollerFoundation.prototype.animate = function (animation) {
	        var _this = this;
	        // Early exit if translateX is 0, which means there's no animation to perform
	        if (animation.scrollDelta === 0) {
	            return;
	        }
	        this.stopScrollAnimation();
	        // This animation uses the FLIP approach.
	        // Read more here: https://aerotwist.com/blog/flip-your-animations/
	        this.adapter.setScrollAreaScrollLeft(animation.finalScrollPosition);
	        this.adapter.setScrollContentStyleProperty('transform', "translateX(" + animation.scrollDelta + "px)");
	        // Force repaint
	        this.adapter.computeScrollAreaClientRect();
	        requestAnimationFrame(function () {
	            _this.adapter.addClass(MDCTabScrollerFoundation.cssClasses.ANIMATING);
	            _this.adapter.setScrollContentStyleProperty('transform', 'none');
	        });
	        this.isAnimating = true;
	    };
	    /**
	     * Stops scroll animation
	     */
	    MDCTabScrollerFoundation.prototype.stopScrollAnimation = function () {
	        this.isAnimating = false;
	        var currentScrollPosition = this.getAnimatingScrollPosition();
	        this.adapter.removeClass(MDCTabScrollerFoundation.cssClasses.ANIMATING);
	        this.adapter.setScrollContentStyleProperty('transform', 'translateX(0px)');
	        this.adapter.setScrollAreaScrollLeft(currentScrollPosition);
	    };
	    /**
	     * Gets the current scroll position during animation
	     */
	    MDCTabScrollerFoundation.prototype.getAnimatingScrollPosition = function () {
	        var currentTranslateX = this.calculateCurrentTranslateX();
	        var scrollLeft = this.adapter.getScrollAreaScrollLeft();
	        if (this.isRTL()) {
	            return this.getRTLScroller().getAnimatingScrollPosition(scrollLeft, currentTranslateX);
	        }
	        return scrollLeft - currentTranslateX;
	    };
	    /**
	     * Determines the RTL Scroller to use
	     */
	    MDCTabScrollerFoundation.prototype.rtlScrollerFactory = function () {
	        // Browsers have three different implementations of scrollLeft in RTL mode,
	        // dependent on the browser. The behavior is based off the max LTR
	        // scrollLeft value and 0.
	        //
	        // * Default scrolling in RTL *
	        //    - Left-most value: 0
	        //    - Right-most value: Max LTR scrollLeft value
	        //
	        // * Negative scrolling in RTL *
	        //    - Left-most value: Negated max LTR scrollLeft value
	        //    - Right-most value: 0
	        //
	        // * Reverse scrolling in RTL *
	        //    - Left-most value: Max LTR scrollLeft value
	        //    - Right-most value: 0
	        //
	        // We use those principles below to determine which RTL scrollLeft
	        // behavior is implemented in the current browser.
	        var initialScrollLeft = this.adapter.getScrollAreaScrollLeft();
	        this.adapter.setScrollAreaScrollLeft(initialScrollLeft - 1);
	        var newScrollLeft = this.adapter.getScrollAreaScrollLeft();
	        // If the newScrollLeft value is negative,then we know that the browser has
	        // implemented negative RTL scrolling, since all other implementations have
	        // only positive values.
	        if (newScrollLeft < 0) {
	            // Undo the scrollLeft test check
	            this.adapter.setScrollAreaScrollLeft(initialScrollLeft);
	            return new MDCTabScrollerRTLNegative(this.adapter);
	        }
	        var rootClientRect = this.adapter.computeScrollAreaClientRect();
	        var contentClientRect = this.adapter.computeScrollContentClientRect();
	        var rightEdgeDelta = Math.round(contentClientRect.right - rootClientRect.right);
	        // Undo the scrollLeft test check
	        this.adapter.setScrollAreaScrollLeft(initialScrollLeft);
	        // By calculating the clientRect of the root element and the clientRect of
	        // the content element, we can determine how much the scroll value changed
	        // when we performed the scrollLeft subtraction above.
	        if (rightEdgeDelta === newScrollLeft) {
	            return new MDCTabScrollerRTLReverse(this.adapter);
	        }
	        return new MDCTabScrollerRTLDefault(this.adapter);
	    };
	    MDCTabScrollerFoundation.prototype.isRTL = function () {
	        return this.adapter.getScrollContentStyleValue('direction') === 'rtl';
	    };
	    return MDCTabScrollerFoundation;
	}(MDCFoundation));

	/**
	 * @license
	 * Copyright 2018 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */
	/**
	 * Stores result from computeHorizontalScrollbarHeight to avoid redundant processing.
	 */
	var horizontalScrollbarHeight_;
	/**
	 * Computes the height of browser-rendered horizontal scrollbars using a self-created test element.
	 * May return 0 (e.g. on OS X browsers under default configuration).
	 */
	function computeHorizontalScrollbarHeight(documentObj, shouldCacheResult) {
	    if (shouldCacheResult === void 0) { shouldCacheResult = true; }
	    if (shouldCacheResult && typeof horizontalScrollbarHeight_ !== 'undefined') {
	        return horizontalScrollbarHeight_;
	    }
	    var el = documentObj.createElement('div');
	    el.classList.add(cssClasses$4.SCROLL_TEST);
	    documentObj.body.appendChild(el);
	    var horizontalScrollbarHeight = el.offsetHeight - el.clientHeight;
	    documentObj.body.removeChild(el);
	    if (shouldCacheResult) {
	        horizontalScrollbarHeight_ = horizontalScrollbarHeight;
	    }
	    return horizontalScrollbarHeight;
	}

	/**
	 * @license
	 * Copyright 2018 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */
	var strings$5 = {
	    ARROW_LEFT_KEY: 'ArrowLeft',
	    ARROW_RIGHT_KEY: 'ArrowRight',
	    END_KEY: 'End',
	    ENTER_KEY: 'Enter',
	    HOME_KEY: 'Home',
	    SPACE_KEY: 'Space',
	    TAB_ACTIVATED_EVENT: 'MDCTabBar:activated',
	    TAB_SCROLLER_SELECTOR: '.mdc-tab-scroller',
	    TAB_SELECTOR: '.mdc-tab',
	};
	var numbers$1 = {
	    ARROW_LEFT_KEYCODE: 37,
	    ARROW_RIGHT_KEYCODE: 39,
	    END_KEYCODE: 35,
	    ENTER_KEYCODE: 13,
	    EXTRA_SCROLL_AMOUNT: 20,
	    HOME_KEYCODE: 36,
	    SPACE_KEYCODE: 32,
	};

	/**
	 * @license
	 * Copyright 2018 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */
	var ACCEPTABLE_KEYS = new Set();
	// IE11 has no support for new Set with iterable so we need to initialize this by hand
	ACCEPTABLE_KEYS.add(strings$5.ARROW_LEFT_KEY);
	ACCEPTABLE_KEYS.add(strings$5.ARROW_RIGHT_KEY);
	ACCEPTABLE_KEYS.add(strings$5.END_KEY);
	ACCEPTABLE_KEYS.add(strings$5.HOME_KEY);
	ACCEPTABLE_KEYS.add(strings$5.ENTER_KEY);
	ACCEPTABLE_KEYS.add(strings$5.SPACE_KEY);
	var KEYCODE_MAP = new Map();
	// IE11 has no support for new Map with iterable so we need to initialize this by hand
	KEYCODE_MAP.set(numbers$1.ARROW_LEFT_KEYCODE, strings$5.ARROW_LEFT_KEY);
	KEYCODE_MAP.set(numbers$1.ARROW_RIGHT_KEYCODE, strings$5.ARROW_RIGHT_KEY);
	KEYCODE_MAP.set(numbers$1.END_KEYCODE, strings$5.END_KEY);
	KEYCODE_MAP.set(numbers$1.HOME_KEYCODE, strings$5.HOME_KEY);
	KEYCODE_MAP.set(numbers$1.ENTER_KEYCODE, strings$5.ENTER_KEY);
	KEYCODE_MAP.set(numbers$1.SPACE_KEYCODE, strings$5.SPACE_KEY);
	var MDCTabBarFoundation = /** @class */ (function (_super) {
	    __extends(MDCTabBarFoundation, _super);
	    function MDCTabBarFoundation(adapter) {
	        var _this = _super.call(this, __assign(__assign({}, MDCTabBarFoundation.defaultAdapter), adapter)) || this;
	        _this.useAutomaticActivation = false;
	        return _this;
	    }
	    Object.defineProperty(MDCTabBarFoundation, "strings", {
	        get: function () {
	            return strings$5;
	        },
	        enumerable: false,
	        configurable: true
	    });
	    Object.defineProperty(MDCTabBarFoundation, "numbers", {
	        get: function () {
	            return numbers$1;
	        },
	        enumerable: false,
	        configurable: true
	    });
	    Object.defineProperty(MDCTabBarFoundation, "defaultAdapter", {
	        get: function () {
	            // tslint:disable:object-literal-sort-keys Methods should be in the same order as the adapter interface.
	            return {
	                scrollTo: function () { return undefined; },
	                incrementScroll: function () { return undefined; },
	                getScrollPosition: function () { return 0; },
	                getScrollContentWidth: function () { return 0; },
	                getOffsetWidth: function () { return 0; },
	                isRTL: function () { return false; },
	                setActiveTab: function () { return undefined; },
	                activateTabAtIndex: function () { return undefined; },
	                deactivateTabAtIndex: function () { return undefined; },
	                focusTabAtIndex: function () { return undefined; },
	                getTabIndicatorClientRectAtIndex: function () {
	                    return ({ top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0 });
	                },
	                getTabDimensionsAtIndex: function () {
	                    return ({ rootLeft: 0, rootRight: 0, contentLeft: 0, contentRight: 0 });
	                },
	                getPreviousActiveTabIndex: function () { return -1; },
	                getFocusedTabIndex: function () { return -1; },
	                getIndexOfTabById: function () { return -1; },
	                getTabListLength: function () { return 0; },
	                notifyTabActivated: function () { return undefined; },
	            };
	            // tslint:enable:object-literal-sort-keys
	        },
	        enumerable: false,
	        configurable: true
	    });
	    /**
	     * Switches between automatic and manual activation modes.
	     * See https://www.w3.org/TR/wai-aria-practices/#tabpanel for examples.
	     */
	    MDCTabBarFoundation.prototype.setUseAutomaticActivation = function (useAutomaticActivation) {
	        this.useAutomaticActivation = useAutomaticActivation;
	    };
	    MDCTabBarFoundation.prototype.activateTab = function (index) {
	        var previousActiveIndex = this.adapter.getPreviousActiveTabIndex();
	        if (!this.indexIsInRange(index) || index === previousActiveIndex) {
	            return;
	        }
	        var previousClientRect;
	        if (previousActiveIndex !== -1) {
	            this.adapter.deactivateTabAtIndex(previousActiveIndex);
	            previousClientRect =
	                this.adapter.getTabIndicatorClientRectAtIndex(previousActiveIndex);
	        }
	        this.adapter.activateTabAtIndex(index, previousClientRect);
	        this.scrollIntoView(index);
	        this.adapter.notifyTabActivated(index);
	    };
	    MDCTabBarFoundation.prototype.handleKeyDown = function (evt) {
	        // Get the key from the event
	        var key = this.getKeyFromEvent(evt);
	        // Early exit if the event key isn't one of the keyboard navigation keys
	        if (key === undefined) {
	            return;
	        }
	        // Prevent default behavior for movement keys, but not for activation keys, since :active is used to apply ripple
	        if (!this.isActivationKey(key)) {
	            evt.preventDefault();
	        }
	        if (this.useAutomaticActivation) {
	            if (this.isActivationKey(key)) {
	                return;
	            }
	            var index = this.determineTargetFromKey(this.adapter.getPreviousActiveTabIndex(), key);
	            this.adapter.setActiveTab(index);
	            this.scrollIntoView(index);
	        }
	        else {
	            var focusedTabIndex = this.adapter.getFocusedTabIndex();
	            if (this.isActivationKey(key)) {
	                this.adapter.setActiveTab(focusedTabIndex);
	            }
	            else {
	                var index = this.determineTargetFromKey(focusedTabIndex, key);
	                this.adapter.focusTabAtIndex(index);
	                this.scrollIntoView(index);
	            }
	        }
	    };
	    /**
	     * Handles the MDCTab:interacted event
	     */
	    MDCTabBarFoundation.prototype.handleTabInteraction = function (evt) {
	        this.adapter.setActiveTab(this.adapter.getIndexOfTabById(evt.detail.tabId));
	    };
	    /**
	     * Scrolls the tab at the given index into view
	     * @param index The tab index to make visible
	     */
	    MDCTabBarFoundation.prototype.scrollIntoView = function (index) {
	        // Early exit if the index is out of range
	        if (!this.indexIsInRange(index)) {
	            return;
	        }
	        // Always scroll to 0 if scrolling to the 0th index
	        if (index === 0) {
	            this.adapter.scrollTo(0);
	            return;
	        }
	        // Always scroll to the max value if scrolling to the Nth index
	        // MDCTabScroller.scrollTo() will never scroll past the max possible value
	        if (index === this.adapter.getTabListLength() - 1) {
	            this.adapter.scrollTo(this.adapter.getScrollContentWidth());
	            return;
	        }
	        if (this.isRTL()) {
	            this.scrollIntoViewImplRTL(index);
	            return;
	        }
	        this.scrollIntoViewImpl(index);
	    };
	    /**
	     * Private method for determining the index of the destination tab based on what key was pressed
	     * @param origin The original index from which to determine the destination
	     * @param key The name of the key
	     */
	    MDCTabBarFoundation.prototype.determineTargetFromKey = function (origin, key) {
	        var isRTL = this.isRTL();
	        var maxIndex = this.adapter.getTabListLength() - 1;
	        var shouldGoToEnd = key === strings$5.END_KEY;
	        var shouldDecrement = key === strings$5.ARROW_LEFT_KEY && !isRTL || key === strings$5.ARROW_RIGHT_KEY && isRTL;
	        var shouldIncrement = key === strings$5.ARROW_RIGHT_KEY && !isRTL || key === strings$5.ARROW_LEFT_KEY && isRTL;
	        var index = origin;
	        if (shouldGoToEnd) {
	            index = maxIndex;
	        }
	        else if (shouldDecrement) {
	            index -= 1;
	        }
	        else if (shouldIncrement) {
	            index += 1;
	        }
	        else {
	            index = 0;
	        }
	        if (index < 0) {
	            index = maxIndex;
	        }
	        else if (index > maxIndex) {
	            index = 0;
	        }
	        return index;
	    };
	    /**
	     * Calculates the scroll increment that will make the tab at the given index visible
	     * @param index The index of the tab
	     * @param nextIndex The index of the next tab
	     * @param scrollPosition The current scroll position
	     * @param barWidth The width of the Tab Bar
	     */
	    MDCTabBarFoundation.prototype.calculateScrollIncrement = function (index, nextIndex, scrollPosition, barWidth) {
	        var nextTabDimensions = this.adapter.getTabDimensionsAtIndex(nextIndex);
	        var relativeContentLeft = nextTabDimensions.contentLeft - scrollPosition - barWidth;
	        var relativeContentRight = nextTabDimensions.contentRight - scrollPosition;
	        var leftIncrement = relativeContentRight - numbers$1.EXTRA_SCROLL_AMOUNT;
	        var rightIncrement = relativeContentLeft + numbers$1.EXTRA_SCROLL_AMOUNT;
	        if (nextIndex < index) {
	            return Math.min(leftIncrement, 0);
	        }
	        return Math.max(rightIncrement, 0);
	    };
	    /**
	     * Calculates the scroll increment that will make the tab at the given index visible in RTL
	     * @param index The index of the tab
	     * @param nextIndex The index of the next tab
	     * @param scrollPosition The current scroll position
	     * @param barWidth The width of the Tab Bar
	     * @param scrollContentWidth The width of the scroll content
	     */
	    MDCTabBarFoundation.prototype.calculateScrollIncrementRTL = function (index, nextIndex, scrollPosition, barWidth, scrollContentWidth) {
	        var nextTabDimensions = this.adapter.getTabDimensionsAtIndex(nextIndex);
	        var relativeContentLeft = scrollContentWidth - nextTabDimensions.contentLeft - scrollPosition;
	        var relativeContentRight = scrollContentWidth - nextTabDimensions.contentRight - scrollPosition - barWidth;
	        var leftIncrement = relativeContentRight + numbers$1.EXTRA_SCROLL_AMOUNT;
	        var rightIncrement = relativeContentLeft - numbers$1.EXTRA_SCROLL_AMOUNT;
	        if (nextIndex > index) {
	            return Math.max(leftIncrement, 0);
	        }
	        return Math.min(rightIncrement, 0);
	    };
	    /**
	     * Determines the index of the adjacent tab closest to either edge of the Tab Bar
	     * @param index The index of the tab
	     * @param tabDimensions The dimensions of the tab
	     * @param scrollPosition The current scroll position
	     * @param barWidth The width of the tab bar
	     */
	    MDCTabBarFoundation.prototype.findAdjacentTabIndexClosestToEdge = function (index, tabDimensions, scrollPosition, barWidth) {
	        /**
	         * Tabs are laid out in the Tab Scroller like this:
	         *
	         *    Scroll Position
	         *    +---+
	         *    |   |   Bar Width
	         *    |   +-----------------------------------+
	         *    |   |                                   |
	         *    |   V                                   V
	         *    |   +-----------------------------------+
	         *    V   |             Tab Scroller          |
	         *    +------------+--------------+-------------------+
	         *    |    Tab     |      Tab     |        Tab        |
	         *    +------------+--------------+-------------------+
	         *        |                                   |
	         *        +-----------------------------------+
	         *
	         * To determine the next adjacent index, we look at the Tab root left and
	         * Tab root right, both relative to the scroll position. If the Tab root
	         * left is less than 0, then we know it's out of view to the left. If the
	         * Tab root right minus the bar width is greater than 0, we know the Tab is
	         * out of view to the right. From there, we either increment or decrement
	         * the index.
	         */
	        var relativeRootLeft = tabDimensions.rootLeft - scrollPosition;
	        var relativeRootRight = tabDimensions.rootRight - scrollPosition - barWidth;
	        var relativeRootDelta = relativeRootLeft + relativeRootRight;
	        var leftEdgeIsCloser = relativeRootLeft < 0 || relativeRootDelta < 0;
	        var rightEdgeIsCloser = relativeRootRight > 0 || relativeRootDelta > 0;
	        if (leftEdgeIsCloser) {
	            return index - 1;
	        }
	        if (rightEdgeIsCloser) {
	            return index + 1;
	        }
	        return -1;
	    };
	    /**
	     * Determines the index of the adjacent tab closest to either edge of the Tab Bar in RTL
	     * @param index The index of the tab
	     * @param tabDimensions The dimensions of the tab
	     * @param scrollPosition The current scroll position
	     * @param barWidth The width of the tab bar
	     * @param scrollContentWidth The width of the scroller content
	     */
	    MDCTabBarFoundation.prototype.findAdjacentTabIndexClosestToEdgeRTL = function (index, tabDimensions, scrollPosition, barWidth, scrollContentWidth) {
	        var rootLeft = scrollContentWidth - tabDimensions.rootLeft - barWidth - scrollPosition;
	        var rootRight = scrollContentWidth - tabDimensions.rootRight - scrollPosition;
	        var rootDelta = rootLeft + rootRight;
	        var leftEdgeIsCloser = rootLeft > 0 || rootDelta > 0;
	        var rightEdgeIsCloser = rootRight < 0 || rootDelta < 0;
	        if (leftEdgeIsCloser) {
	            return index + 1;
	        }
	        if (rightEdgeIsCloser) {
	            return index - 1;
	        }
	        return -1;
	    };
	    /**
	     * Returns the key associated with a keydown event
	     * @param evt The keydown event
	     */
	    MDCTabBarFoundation.prototype.getKeyFromEvent = function (evt) {
	        if (ACCEPTABLE_KEYS.has(evt.key)) {
	            return evt.key;
	        }
	        return KEYCODE_MAP.get(evt.keyCode);
	    };
	    MDCTabBarFoundation.prototype.isActivationKey = function (key) {
	        return key === strings$5.SPACE_KEY || key === strings$5.ENTER_KEY;
	    };
	    /**
	     * Returns whether a given index is inclusively between the ends
	     * @param index The index to test
	     */
	    MDCTabBarFoundation.prototype.indexIsInRange = function (index) {
	        return index >= 0 && index < this.adapter.getTabListLength();
	    };
	    /**
	     * Returns the view's RTL property
	     */
	    MDCTabBarFoundation.prototype.isRTL = function () {
	        return this.adapter.isRTL();
	    };
	    /**
	     * Scrolls the tab at the given index into view for left-to-right user agents.
	     * @param index The index of the tab to scroll into view
	     */
	    MDCTabBarFoundation.prototype.scrollIntoViewImpl = function (index) {
	        var scrollPosition = this.adapter.getScrollPosition();
	        var barWidth = this.adapter.getOffsetWidth();
	        var tabDimensions = this.adapter.getTabDimensionsAtIndex(index);
	        var nextIndex = this.findAdjacentTabIndexClosestToEdge(index, tabDimensions, scrollPosition, barWidth);
	        if (!this.indexIsInRange(nextIndex)) {
	            return;
	        }
	        var scrollIncrement = this.calculateScrollIncrement(index, nextIndex, scrollPosition, barWidth);
	        this.adapter.incrementScroll(scrollIncrement);
	    };
	    /**
	     * Scrolls the tab at the given index into view in RTL
	     * @param index The tab index to make visible
	     */
	    MDCTabBarFoundation.prototype.scrollIntoViewImplRTL = function (index) {
	        var scrollPosition = this.adapter.getScrollPosition();
	        var barWidth = this.adapter.getOffsetWidth();
	        var tabDimensions = this.adapter.getTabDimensionsAtIndex(index);
	        var scrollWidth = this.adapter.getScrollContentWidth();
	        var nextIndex = this.findAdjacentTabIndexClosestToEdgeRTL(index, tabDimensions, scrollPosition, barWidth, scrollWidth);
	        if (!this.indexIsInRange(nextIndex)) {
	            return;
	        }
	        var scrollIncrement = this.calculateScrollIncrementRTL(index, nextIndex, scrollPosition, barWidth, scrollWidth);
	        this.adapter.incrementScroll(scrollIncrement);
	    };
	    return MDCTabBarFoundation;
	}(MDCFoundation));

	/* node_modules/@smui/tab-scroller/dist/TabScroller.svelte generated by Svelte v4.2.7 */

	function create_fragment$c(ctx) {
		let div2;
		let div1;
		let div0;
		let div0_class_value;
		let div0_style_value;
		let useActions_action;
		let div1_class_value;
		let div1_style_value;
		let useActions_action_1;
		let div2_class_value;
		let useActions_action_2;
		let current;
		let mounted;
		let dispose;
		const default_slot_template = /*#slots*/ ctx[23].default;
		const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[22], null);

		let div0_levels = [
			{
				class: div0_class_value = classMap({
					[/*scrollContent$class*/ ctx[6]]: true,
					'mdc-tab-scroller__scroll-content': true
				})
			},
			{
				style: div0_style_value = Object.entries(/*scrollContentStyles*/ ctx[14]).map(func$3).join(' ')
			},
			prefixFilter(/*$$restProps*/ ctx[16], 'scrollContent$')
		];

		let div_data = {};

		for (let i = 0; i < div0_levels.length; i += 1) {
			div_data = assign(div_data, div0_levels[i]);
		}

		let div1_levels = [
			{
				class: div1_class_value = classMap({
					[/*scrollArea$class*/ ctx[4]]: true,
					'mdc-tab-scroller__scroll-area': true,
					.../*scrollAreaClasses*/ ctx[12]
				})
			},
			{
				style: div1_style_value = Object.entries(/*scrollAreaStyles*/ ctx[13]).map(func_1).join(' ')
			},
			prefixFilter(/*$$restProps*/ ctx[16], 'scrollArea$')
		];

		let div_data_1 = {};

		for (let i = 0; i < div1_levels.length; i += 1) {
			div_data_1 = assign(div_data_1, div1_levels[i]);
		}

		let div2_levels = [
			{
				class: div2_class_value = classMap({
					[/*className*/ ctx[1]]: true,
					'mdc-tab-scroller': true,
					'mdc-tab-scroller--align-start': /*align*/ ctx[2] === 'start',
					'mdc-tab-scroller--align-end': /*align*/ ctx[2] === 'end',
					'mdc-tab-scroller--align-center': /*align*/ ctx[2] === 'center',
					.../*internalClasses*/ ctx[11]
				})
			},
			exclude(/*$$restProps*/ ctx[16], ['scrollArea$', 'scrollContent$'])
		];

		let div_data_2 = {};

		for (let i = 0; i < div2_levels.length; i += 1) {
			div_data_2 = assign(div_data_2, div2_levels[i]);
		}

		return {
			c() {
				div2 = element("div");
				div1 = element("div");
				div0 = element("div");
				if (default_slot) default_slot.c();
				set_attributes(div0, div_data);
				set_attributes(div1, div_data_1);
				set_attributes(div2, div_data_2);
			},
			m(target, anchor) {
				insert(target, div2, anchor);
				append(div2, div1);
				append(div1, div0);

				if (default_slot) {
					default_slot.m(div0, null);
				}

				/*div0_binding*/ ctx[24](div0);
				/*div1_binding*/ ctx[26](div1);
				/*div2_binding*/ ctx[32](div2);
				current = true;

				if (!mounted) {
					dispose = [
						action_destroyer(useActions_action = useActions.call(null, div0, /*scrollContent$use*/ ctx[5])),
						listen$1(div0, "transitionend", /*transitionend_handler*/ ctx[25]),
						action_destroyer(useActions_action_1 = useActions.call(null, div1, /*scrollArea$use*/ ctx[3])),
						listen$1(div1, "wheel", /*wheel_handler*/ ctx[27], { passive: true }),
						listen$1(div1, "touchstart", /*touchstart_handler*/ ctx[28], { passive: true }),
						listen$1(div1, "pointerdown", /*pointerdown_handler*/ ctx[29]),
						listen$1(div1, "mousedown", /*mousedown_handler*/ ctx[30]),
						listen$1(div1, "keydown", /*keydown_handler*/ ctx[31]),
						action_destroyer(useActions_action_2 = useActions.call(null, div2, /*use*/ ctx[0])),
						action_destroyer(/*forwardEvents*/ ctx[15].call(null, div2))
					];

					mounted = true;
				}
			},
			p(ctx, dirty) {
				if (default_slot) {
					if (default_slot.p && (!current || dirty[0] & /*$$scope*/ 4194304)) {
						update_slot_base(
							default_slot,
							default_slot_template,
							ctx,
							/*$$scope*/ ctx[22],
							!current
							? get_all_dirty_from_scope(/*$$scope*/ ctx[22])
							: get_slot_changes(default_slot_template, /*$$scope*/ ctx[22], dirty, null),
							null
						);
					}
				}

				set_attributes(div0, div_data = get_spread_update(div0_levels, [
					(!current || dirty[0] & /*scrollContent$class*/ 64 && div0_class_value !== (div0_class_value = classMap({
						[/*scrollContent$class*/ ctx[6]]: true,
						'mdc-tab-scroller__scroll-content': true
					}))) && { class: div0_class_value },
					(!current || dirty[0] & /*scrollContentStyles*/ 16384 && div0_style_value !== (div0_style_value = Object.entries(/*scrollContentStyles*/ ctx[14]).map(func$3).join(' '))) && { style: div0_style_value },
					dirty[0] & /*$$restProps*/ 65536 && prefixFilter(/*$$restProps*/ ctx[16], 'scrollContent$')
				]));

				if (useActions_action && is_function(useActions_action.update) && dirty[0] & /*scrollContent$use*/ 32) useActions_action.update.call(null, /*scrollContent$use*/ ctx[5]);

				set_attributes(div1, div_data_1 = get_spread_update(div1_levels, [
					(!current || dirty[0] & /*scrollArea$class, scrollAreaClasses*/ 4112 && div1_class_value !== (div1_class_value = classMap({
						[/*scrollArea$class*/ ctx[4]]: true,
						'mdc-tab-scroller__scroll-area': true,
						.../*scrollAreaClasses*/ ctx[12]
					}))) && { class: div1_class_value },
					(!current || dirty[0] & /*scrollAreaStyles*/ 8192 && div1_style_value !== (div1_style_value = Object.entries(/*scrollAreaStyles*/ ctx[13]).map(func_1).join(' '))) && { style: div1_style_value },
					dirty[0] & /*$$restProps*/ 65536 && prefixFilter(/*$$restProps*/ ctx[16], 'scrollArea$')
				]));

				if (useActions_action_1 && is_function(useActions_action_1.update) && dirty[0] & /*scrollArea$use*/ 8) useActions_action_1.update.call(null, /*scrollArea$use*/ ctx[3]);

				set_attributes(div2, div_data_2 = get_spread_update(div2_levels, [
					(!current || dirty[0] & /*className, align, internalClasses*/ 2054 && div2_class_value !== (div2_class_value = classMap({
						[/*className*/ ctx[1]]: true,
						'mdc-tab-scroller': true,
						'mdc-tab-scroller--align-start': /*align*/ ctx[2] === 'start',
						'mdc-tab-scroller--align-end': /*align*/ ctx[2] === 'end',
						'mdc-tab-scroller--align-center': /*align*/ ctx[2] === 'center',
						.../*internalClasses*/ ctx[11]
					}))) && { class: div2_class_value },
					dirty[0] & /*$$restProps*/ 65536 && exclude(/*$$restProps*/ ctx[16], ['scrollArea$', 'scrollContent$'])
				]));

				if (useActions_action_2 && is_function(useActions_action_2.update) && dirty[0] & /*use*/ 1) useActions_action_2.update.call(null, /*use*/ ctx[0]);
			},
			i(local) {
				if (current) return;
				transition_in(default_slot, local);
				current = true;
			},
			o(local) {
				transition_out(default_slot, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(div2);
				}

				if (default_slot) default_slot.d(detaching);
				/*div0_binding*/ ctx[24](null);
				/*div1_binding*/ ctx[26](null);
				/*div2_binding*/ ctx[32](null);
				mounted = false;
				run_all(dispose);
			}
		};
	}

	const func$3 = ([name, value]) => `${name}: ${value};`;
	const func_1 = ([name, value]) => `${name}: ${value};`;

	function instance_1$5($$self, $$props, $$invalidate) {
		const omit_props_names = [
			"use","class","align","scrollArea$use","scrollArea$class","scrollContent$use","scrollContent$class","getScrollPosition","getScrollContentWidth","incrementScroll","scrollTo","getElement"
		];

		let $$restProps = compute_rest_props($$props, omit_props_names);
		let { $$slots: slots = {}, $$scope } = $$props;
		const { matches } = ponyfill;
		const forwardEvents = forwardEventsBuilder(get_current_component());
		let { use = [] } = $$props;
		let { class: className = '' } = $$props;
		let { align = undefined } = $$props;
		let { scrollArea$use = [] } = $$props;
		let { scrollArea$class = '' } = $$props;
		let { scrollContent$use = [] } = $$props;
		let { scrollContent$class = '' } = $$props;
		let element;
		let instance;
		let scrollArea;
		let scrollContent;
		let internalClasses = {};
		let scrollAreaClasses = {};
		let scrollAreaStyles = {};
		let scrollContentStyles = {};

		onMount(() => {
			$$invalidate(8, instance = new MDCTabScrollerFoundation({
					eventTargetMatchesSelector: (evtTarget, selector) => matches(evtTarget, selector),
					addClass,
					removeClass,
					addScrollAreaClass,
					setScrollAreaStyleProperty: addScrollAreaStyle,
					setScrollContentStyleProperty: addScrollContentStyle,
					getScrollContentStyleValue: getScrollContentStyle,
					setScrollAreaScrollLeft: scrollX => $$invalidate(9, scrollArea.scrollLeft = scrollX, scrollArea),
					getScrollAreaScrollLeft: () => scrollArea.scrollLeft,
					getScrollContentOffsetWidth: () => scrollContent.offsetWidth,
					getScrollAreaOffsetWidth: () => scrollArea.offsetWidth,
					computeScrollAreaClientRect: () => scrollArea.getBoundingClientRect(),
					computeScrollContentClientRect: () => scrollContent.getBoundingClientRect(),
					computeHorizontalScrollbarHeight: () => computeHorizontalScrollbarHeight(document)
				}));

			instance.init();

			return () => {
				instance.destroy();
			};
		});

		function addClass(className) {
			if (!internalClasses[className]) {
				$$invalidate(11, internalClasses[className] = true, internalClasses);
			}
		}

		function removeClass(className) {
			if (!(className in internalClasses) || internalClasses[className]) {
				$$invalidate(11, internalClasses[className] = false, internalClasses);
			}
		}

		function addScrollAreaClass(className) {
			if (!scrollAreaClasses[className]) {
				$$invalidate(12, scrollAreaClasses[className] = true, scrollAreaClasses);
			}
		}

		function addScrollAreaStyle(name, value) {
			if (scrollAreaStyles[name] != value) {
				if (value === '' || value == null) {
					delete scrollAreaStyles[name];
					$$invalidate(13, scrollAreaStyles);
				} else {
					$$invalidate(13, scrollAreaStyles[name] = value, scrollAreaStyles);
				}
			}
		}

		function addScrollContentStyle(name, value) {
			if (scrollContentStyles[name] != value) {
				if (value === '' || value == null) {
					delete scrollContentStyles[name];
					$$invalidate(14, scrollContentStyles);
				} else {
					$$invalidate(14, scrollContentStyles[name] = value, scrollContentStyles);
				}
			}
		}

		function getScrollContentStyle(name) {
			return name in scrollContentStyles
			? scrollContentStyles[name]
			: getComputedStyle(scrollContent).getPropertyValue(name);
		}

		function getScrollPosition() {
			return instance.getScrollPosition();
		}

		function getScrollContentWidth() {
			return scrollContent.offsetWidth;
		}

		function incrementScroll(scrollXIncrement) {
			instance.incrementScroll(scrollXIncrement);
		}

		function scrollTo(scrollX) {
			instance.scrollTo(scrollX);
		}

		function getElement() {
			return element;
		}

		function div0_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				scrollContent = $$value;
				$$invalidate(10, scrollContent);
			});
		}

		const transitionend_handler = event => instance && instance.handleTransitionEnd(event);

		function div1_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				scrollArea = $$value;
				$$invalidate(9, scrollArea);
			});
		}

		const wheel_handler = () => instance && instance.handleInteraction();
		const touchstart_handler = () => instance && instance.handleInteraction();
		const pointerdown_handler = () => instance && instance.handleInteraction();
		const mousedown_handler = () => instance && instance.handleInteraction();
		const keydown_handler = () => instance && instance.handleInteraction();

		function div2_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				element = $$value;
				$$invalidate(7, element);
			});
		}

		$$self.$$set = $$new_props => {
			$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
			$$invalidate(16, $$restProps = compute_rest_props($$props, omit_props_names));
			if ('use' in $$new_props) $$invalidate(0, use = $$new_props.use);
			if ('class' in $$new_props) $$invalidate(1, className = $$new_props.class);
			if ('align' in $$new_props) $$invalidate(2, align = $$new_props.align);
			if ('scrollArea$use' in $$new_props) $$invalidate(3, scrollArea$use = $$new_props.scrollArea$use);
			if ('scrollArea$class' in $$new_props) $$invalidate(4, scrollArea$class = $$new_props.scrollArea$class);
			if ('scrollContent$use' in $$new_props) $$invalidate(5, scrollContent$use = $$new_props.scrollContent$use);
			if ('scrollContent$class' in $$new_props) $$invalidate(6, scrollContent$class = $$new_props.scrollContent$class);
			if ('$$scope' in $$new_props) $$invalidate(22, $$scope = $$new_props.$$scope);
		};

		return [
			use,
			className,
			align,
			scrollArea$use,
			scrollArea$class,
			scrollContent$use,
			scrollContent$class,
			element,
			instance,
			scrollArea,
			scrollContent,
			internalClasses,
			scrollAreaClasses,
			scrollAreaStyles,
			scrollContentStyles,
			forwardEvents,
			$$restProps,
			getScrollPosition,
			getScrollContentWidth,
			incrementScroll,
			scrollTo,
			getElement,
			$$scope,
			slots,
			div0_binding,
			transitionend_handler,
			div1_binding,
			wheel_handler,
			touchstart_handler,
			pointerdown_handler,
			mousedown_handler,
			keydown_handler,
			div2_binding
		];
	}

	class TabScroller extends SvelteComponent {
		constructor(options) {
			super();

			init(
				this,
				options,
				instance_1$5,
				create_fragment$c,
				safe_not_equal,
				{
					use: 0,
					class: 1,
					align: 2,
					scrollArea$use: 3,
					scrollArea$class: 4,
					scrollContent$use: 5,
					scrollContent$class: 6,
					getScrollPosition: 17,
					getScrollContentWidth: 18,
					incrementScroll: 19,
					scrollTo: 20,
					getElement: 21
				},
				null,
				[-1, -1]
			);
		}

		get getScrollPosition() {
			return this.$$.ctx[17];
		}

		get getScrollContentWidth() {
			return this.$$.ctx[18];
		}

		get incrementScroll() {
			return this.$$.ctx[19];
		}

		get scrollTo() {
			return this.$$.ctx[20];
		}

		get getElement() {
			return this.$$.ctx[21];
		}
	}

	/* node_modules/@smui/tab-bar/dist/TabBar.svelte generated by Svelte v4.2.7 */

	function get_each_context$2(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[29] = list[i];
		return child_ctx;
	}

	const get_default_slot_changes$1 = dirty => ({ tab: dirty[0] & /*tabs*/ 4 });
	const get_default_slot_context$1 = ctx => ({ tab: /*tab*/ ctx[29] });

	// (22:4) {#each tabs as tab (key(tab))}
	function create_each_block$2(key_2, ctx) {
		let first;
		let current;
		const default_slot_template = /*#slots*/ ctx[21].default;
		const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[24], get_default_slot_context$1);

		return {
			key: key_2,
			first: null,
			c() {
				first = empty();
				if (default_slot) default_slot.c();
				this.first = first;
			},
			m(target, anchor) {
				insert(target, first, anchor);

				if (default_slot) {
					default_slot.m(target, anchor);
				}

				current = true;
			},
			p(new_ctx, dirty) {
				ctx = new_ctx;

				if (default_slot) {
					if (default_slot.p && (!current || dirty[0] & /*$$scope, tabs*/ 16777220)) {
						update_slot_base(
							default_slot,
							default_slot_template,
							ctx,
							/*$$scope*/ ctx[24],
							!current
							? get_all_dirty_from_scope(/*$$scope*/ ctx[24])
							: get_slot_changes(default_slot_template, /*$$scope*/ ctx[24], dirty, get_default_slot_changes$1),
							get_default_slot_context$1
						);
					}
				}
			},
			i(local) {
				if (current) return;
				transition_in(default_slot, local);
				current = true;
			},
			o(local) {
				transition_out(default_slot, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(first);
				}

				if (default_slot) default_slot.d(detaching);
			}
		};
	}

	// (18:2) <TabScroller     bind:this={tabScroller}     {...prefixFilter($$restProps, 'tabScroller$')}   >
	function create_default_slot$5(ctx) {
		let each_blocks = [];
		let each_1_lookup = new Map();
		let each_1_anchor;
		let current;
		let each_value = ensure_array_like(/*tabs*/ ctx[2]);
		const get_key = ctx => /*key*/ ctx[3](/*tab*/ ctx[29]);

		for (let i = 0; i < each_value.length; i += 1) {
			let child_ctx = get_each_context$2(ctx, each_value, i);
			let key = get_key(child_ctx);
			each_1_lookup.set(key, each_blocks[i] = create_each_block$2(key, child_ctx));
		}

		return {
			c() {
				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				each_1_anchor = empty();
			},
			m(target, anchor) {
				for (let i = 0; i < each_blocks.length; i += 1) {
					if (each_blocks[i]) {
						each_blocks[i].m(target, anchor);
					}
				}

				insert(target, each_1_anchor, anchor);
				current = true;
			},
			p(ctx, dirty) {
				if (dirty[0] & /*$$scope, tabs, key*/ 16777228) {
					each_value = ensure_array_like(/*tabs*/ ctx[2]);
					group_outros();
					each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, each_1_anchor.parentNode, outro_and_destroy_block, create_each_block$2, each_1_anchor, get_each_context$2);
					check_outros();
				}
			},
			i(local) {
				if (current) return;

				for (let i = 0; i < each_value.length; i += 1) {
					transition_in(each_blocks[i]);
				}

				current = true;
			},
			o(local) {
				for (let i = 0; i < each_blocks.length; i += 1) {
					transition_out(each_blocks[i]);
				}

				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(each_1_anchor);
				}

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].d(detaching);
				}
			}
		};
	}

	function create_fragment$b(ctx) {
		let div;
		let tabscroller;
		let div_class_value;
		let useActions_action;
		let current;
		let mounted;
		let dispose;
		const tabscroller_spread_levels = [prefixFilter(/*$$restProps*/ ctx[11], 'tabScroller$')];

		let tabscroller_props = {
			$$slots: { default: [create_default_slot$5] },
			$$scope: { ctx }
		};

		for (let i = 0; i < tabscroller_spread_levels.length; i += 1) {
			tabscroller_props = assign(tabscroller_props, tabscroller_spread_levels[i]);
		}

		tabscroller = new TabScroller({ props: tabscroller_props });
		/*tabscroller_binding*/ ctx[22](tabscroller);

		let div_levels = [
			{
				class: div_class_value = classMap({
					[/*className*/ ctx[1]]: true,
					'mdc-tab-bar': true
				})
			},
			{ role: "tablist" },
			{ tabindex: /*tabindex*/ ctx[4] },
			exclude(/*$$restProps*/ ctx[11], ['tabScroller$'])
		];

		let div_data = {};

		for (let i = 0; i < div_levels.length; i += 1) {
			div_data = assign(div_data, div_levels[i]);
		}

		return {
			c() {
				div = element("div");
				create_component(tabscroller.$$.fragment);
				set_attributes(div, div_data);
			},
			m(target, anchor) {
				insert(target, div, anchor);
				mount_component(tabscroller, div, null);
				/*div_binding*/ ctx[23](div);
				current = true;

				if (!mounted) {
					dispose = [
						action_destroyer(useActions_action = useActions.call(null, div, /*use*/ ctx[0])),
						action_destroyer(/*forwardEvents*/ ctx[8].call(null, div)),
						listen$1(div, "SMUITab:mount", /*handleTabMount*/ ctx[9]),
						listen$1(div, "SMUITab:unmount", /*handleTabUnmount*/ ctx[10]),
						listen$1(div, "SMUITab:interacted", function () {
							if (is_function(/*instance*/ ctx[5] && /*instance*/ ctx[5].handleTabInteraction.bind(/*instance*/ ctx[5]))) (/*instance*/ ctx[5] && /*instance*/ ctx[5].handleTabInteraction.bind(/*instance*/ ctx[5])).apply(this, arguments);
						}),
						listen$1(div, "keydown", function () {
							if (is_function(/*instance*/ ctx[5] && /*instance*/ ctx[5].handleKeyDown.bind(/*instance*/ ctx[5]))) (/*instance*/ ctx[5] && /*instance*/ ctx[5].handleKeyDown.bind(/*instance*/ ctx[5])).apply(this, arguments);
						})
					];

					mounted = true;
				}
			},
			p(new_ctx, dirty) {
				ctx = new_ctx;

				const tabscroller_changes = (dirty[0] & /*$$restProps*/ 2048)
				? get_spread_update(tabscroller_spread_levels, [get_spread_object(prefixFilter(/*$$restProps*/ ctx[11], 'tabScroller$'))])
				: {};

				if (dirty[0] & /*$$scope, tabs*/ 16777220) {
					tabscroller_changes.$$scope = { dirty, ctx };
				}

				tabscroller.$set(tabscroller_changes);

				set_attributes(div, div_data = get_spread_update(div_levels, [
					(!current || dirty[0] & /*className*/ 2 && div_class_value !== (div_class_value = classMap({
						[/*className*/ ctx[1]]: true,
						'mdc-tab-bar': true
					}))) && { class: div_class_value },
					{ role: "tablist" },
					(!current || dirty[0] & /*tabindex*/ 16) && { tabindex: /*tabindex*/ ctx[4] },
					dirty[0] & /*$$restProps*/ 2048 && exclude(/*$$restProps*/ ctx[11], ['tabScroller$'])
				]));

				if (useActions_action && is_function(useActions_action.update) && dirty[0] & /*use*/ 1) useActions_action.update.call(null, /*use*/ ctx[0]);
			},
			i(local) {
				if (current) return;
				transition_in(tabscroller.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(tabscroller.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(div);
				}

				/*tabscroller_binding*/ ctx[22](null);
				destroy_component(tabscroller);
				/*div_binding*/ ctx[23](null);
				mounted = false;
				run_all(dispose);
			}
		};
	}

	function instance_1$4($$self, $$props, $$invalidate) {
		const omit_props_names = [
			"use","class","tabs","key","focusOnActivate","focusOnProgrammatic","useAutomaticActivation","active","tabindex","scrollIntoView","getElement"
		];

		let $$restProps = compute_rest_props($$props, omit_props_names);
		let { $$slots: slots = {}, $$scope } = $$props;
		const forwardEvents = forwardEventsBuilder(get_current_component());
		let { use = [] } = $$props;
		let { class: className = '' } = $$props;
		let { tabs = [] } = $$props;
		let { key = tab => tab } = $$props;
		let { focusOnActivate = true } = $$props;
		let { focusOnProgrammatic = false } = $$props;
		let { useAutomaticActivation = true } = $$props;
		let { active = undefined } = $$props;
		let { tabindex = 0 } = $$props;
		let element;
		let instance;
		let tabScroller;
		let activeIndex = tabs.indexOf(active);
		let tabAccessorMap = {};
		let tabAccessorWeakMap = new WeakMap();
		let skipFocus = false;
		setContext('SMUI:tab:focusOnActivate', focusOnActivate);
		setContext('SMUI:tab:initialActive', active);

		onMount(() => {
			$$invalidate(5, instance = new MDCTabBarFoundation({
					scrollTo: scrollX => tabScroller.scrollTo(scrollX),
					incrementScroll: scrollXIncrement => tabScroller.incrementScroll(scrollXIncrement),
					getScrollPosition: () => tabScroller.getScrollPosition(),
					getScrollContentWidth: () => tabScroller.getScrollContentWidth(),
					getOffsetWidth: () => getElement().offsetWidth,
					isRTL: () => getComputedStyle(getElement()).getPropertyValue('direction') === 'rtl',
					setActiveTab: index => {
						$$invalidate(12, active = tabs[index]);
						$$invalidate(18, activeIndex = index);
						instance.activateTab(index);
					},
					activateTabAtIndex: (index, clientRect) => {
						var _a;

						return (_a = getAccessor(tabs[index])) === null || _a === void 0
						? void 0
						: _a.activate(clientRect, skipFocus);
					},
					deactivateTabAtIndex: index => {
						var _a;

						return (_a = getAccessor(tabs[index])) === null || _a === void 0
						? void 0
						: _a.deactivate();
					},
					focusTabAtIndex: index => {
						var _a;

						return (_a = getAccessor(tabs[index])) === null || _a === void 0
						? void 0
						: _a.focus();
					},
					getTabIndicatorClientRectAtIndex: index => {
						var _a, _b;

						return (_b = (_a = getAccessor(tabs[index])) === null || _a === void 0
						? void 0
						: _a.computeIndicatorClientRect()) !== null && _b !== void 0
						? _b
						: new DOMRect();
					},
					getTabDimensionsAtIndex: index => {
						var _a, _b;

						return (_b = (_a = getAccessor(tabs[index])) === null || _a === void 0
						? void 0
						: _a.computeDimensions()) !== null && _b !== void 0
						? _b
						: {
								rootLeft: 0,
								rootRight: 0,
								contentLeft: 0,
								contentRight: 0
							};
					},
					getPreviousActiveTabIndex: () => {
						var _a;

						for (let i = 0; i < tabs.length; i++) {
							if ((_a = getAccessor(tabs[i])) === null || _a === void 0
							? void 0
							: _a.active) {
								return i;
							}
						}

						return -1;
					},
					getFocusedTabIndex: () => {
						const tabElements = tabs.map(tab => {
							var _a;

							return (_a = getAccessor(tab)) === null || _a === void 0
							? void 0
							: _a.element;
						});

						const activeElement = document.activeElement;
						return tabElements.indexOf(activeElement);
					},
					getIndexOfTabById: id => tabs.indexOf(id),
					getTabListLength: () => tabs.length,
					notifyTabActivated: index => dispatch(getElement(), 'SMUITabBar:activated', { index }, undefined, true)
				}));

			instance.init();

			return () => {
				instance.destroy();
			};
		});

		function handleTabMount(event) {
			const accessor = event.detail;
			addAccessor(accessor.tabId, accessor);
		}

		function handleTabUnmount(event) {
			const accessor = event.detail;
			removeAccessor(accessor.tabId);
		}

		function getAccessor(tabId) {
			return tabId instanceof Object
			? tabAccessorWeakMap.get(tabId)
			: tabAccessorMap[tabId];
		}

		function addAccessor(tabId, accessor) {
			if (tabId instanceof Object) {
				tabAccessorWeakMap.set(tabId, accessor);
				$$invalidate(20, tabAccessorWeakMap);
			} else {
				$$invalidate(19, tabAccessorMap[tabId] = accessor, tabAccessorMap);
				$$invalidate(19, tabAccessorMap);
			}
		}

		function removeAccessor(tabId) {
			if (tabId instanceof Object) {
				tabAccessorWeakMap.delete(tabId);
				$$invalidate(20, tabAccessorWeakMap);
			} else {
				delete tabAccessorMap[tabId];
				$$invalidate(19, tabAccessorMap);
			}
		}

		function scrollIntoView(index) {
			instance.scrollIntoView(index);
		}

		function getElement() {
			return element;
		}

		function tabscroller_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				tabScroller = $$value;
				$$invalidate(7, tabScroller);
			});
		}

		function div_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				element = $$value;
				$$invalidate(6, element);
			});
		}

		$$self.$$set = $$new_props => {
			$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
			$$invalidate(11, $$restProps = compute_rest_props($$props, omit_props_names));
			if ('use' in $$new_props) $$invalidate(0, use = $$new_props.use);
			if ('class' in $$new_props) $$invalidate(1, className = $$new_props.class);
			if ('tabs' in $$new_props) $$invalidate(2, tabs = $$new_props.tabs);
			if ('key' in $$new_props) $$invalidate(3, key = $$new_props.key);
			if ('focusOnActivate' in $$new_props) $$invalidate(13, focusOnActivate = $$new_props.focusOnActivate);
			if ('focusOnProgrammatic' in $$new_props) $$invalidate(14, focusOnProgrammatic = $$new_props.focusOnProgrammatic);
			if ('useAutomaticActivation' in $$new_props) $$invalidate(15, useAutomaticActivation = $$new_props.useAutomaticActivation);
			if ('active' in $$new_props) $$invalidate(12, active = $$new_props.active);
			if ('tabindex' in $$new_props) $$invalidate(4, tabindex = $$new_props.tabindex);
			if ('$$scope' in $$new_props) $$invalidate(24, $$scope = $$new_props.$$scope);
		};

		$$self.$$.update = () => {
			if ($$self.$$.dirty[0] & /*active, tabs, activeIndex, instance, focusOnProgrammatic*/ 282660) {
				if (active !== tabs[activeIndex]) {
					$$invalidate(18, activeIndex = tabs.indexOf(active));

					if (instance) {
						skipFocus = !focusOnProgrammatic;
						instance.activateTab(activeIndex);
						skipFocus = false;
					}
				}
			}

			if ($$self.$$.dirty[0] & /*tabs, tabAccessorWeakMap, tabAccessorMap, activeIndex*/ 1835012) {
				if (tabs.length) {
					// Manually get the accessor so it is reactive.
					const accessor = tabs[0] instanceof Object
					? tabAccessorWeakMap.get(tabs[0])
					: tabAccessorMap[tabs[0]];

					if (accessor) {
						accessor.forceAccessible(activeIndex === -1);
					}
				}
			}

			if ($$self.$$.dirty[0] & /*instance, useAutomaticActivation*/ 32800) {
				if (instance) {
					instance.setUseAutomaticActivation(useAutomaticActivation);
				}
			}
		};

		return [
			use,
			className,
			tabs,
			key,
			tabindex,
			instance,
			element,
			tabScroller,
			forwardEvents,
			handleTabMount,
			handleTabUnmount,
			$$restProps,
			active,
			focusOnActivate,
			focusOnProgrammatic,
			useAutomaticActivation,
			scrollIntoView,
			getElement,
			activeIndex,
			tabAccessorMap,
			tabAccessorWeakMap,
			slots,
			tabscroller_binding,
			div_binding,
			$$scope
		];
	}

	class TabBar extends SvelteComponent {
		constructor(options) {
			super();

			init(
				this,
				options,
				instance_1$4,
				create_fragment$b,
				safe_not_equal,
				{
					use: 0,
					class: 1,
					tabs: 2,
					key: 3,
					focusOnActivate: 13,
					focusOnProgrammatic: 14,
					useAutomaticActivation: 15,
					active: 12,
					tabindex: 4,
					scrollIntoView: 16,
					getElement: 17
				},
				null,
				[-1, -1]
			);
		}

		get scrollIntoView() {
			return this.$$.ctx[16];
		}

		get getElement() {
			return this.$$.ctx[17];
		}
	}

	/**
	 * @license
	 * Copyright 2016 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */
	var cssClasses$3 = {
	    ANIM_CHECKED_INDETERMINATE: 'mdc-checkbox--anim-checked-indeterminate',
	    ANIM_CHECKED_UNCHECKED: 'mdc-checkbox--anim-checked-unchecked',
	    ANIM_INDETERMINATE_CHECKED: 'mdc-checkbox--anim-indeterminate-checked',
	    ANIM_INDETERMINATE_UNCHECKED: 'mdc-checkbox--anim-indeterminate-unchecked',
	    ANIM_UNCHECKED_CHECKED: 'mdc-checkbox--anim-unchecked-checked',
	    ANIM_UNCHECKED_INDETERMINATE: 'mdc-checkbox--anim-unchecked-indeterminate',
	    BACKGROUND: 'mdc-checkbox__background',
	    CHECKED: 'mdc-checkbox--checked',
	    CHECKMARK: 'mdc-checkbox__checkmark',
	    CHECKMARK_PATH: 'mdc-checkbox__checkmark-path',
	    DISABLED: 'mdc-checkbox--disabled',
	    INDETERMINATE: 'mdc-checkbox--indeterminate',
	    MIXEDMARK: 'mdc-checkbox__mixedmark',
	    NATIVE_CONTROL: 'mdc-checkbox__native-control',
	    ROOT: 'mdc-checkbox',
	    SELECTED: 'mdc-checkbox--selected',
	    UPGRADED: 'mdc-checkbox--upgraded',
	};
	var strings$4 = {
	    ARIA_CHECKED_ATTR: 'aria-checked',
	    ARIA_CHECKED_INDETERMINATE_VALUE: 'mixed',
	    DATA_INDETERMINATE_ATTR: 'data-indeterminate',
	    NATIVE_CONTROL_SELECTOR: '.mdc-checkbox__native-control',
	    TRANSITION_STATE_CHECKED: 'checked',
	    TRANSITION_STATE_INDETERMINATE: 'indeterminate',
	    TRANSITION_STATE_INIT: 'init',
	    TRANSITION_STATE_UNCHECKED: 'unchecked',
	};
	var numbers = {
	    ANIM_END_LATCH_MS: 250,
	};

	/**
	 * @license
	 * Copyright 2016 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */
	var MDCCheckboxFoundation = /** @class */ (function (_super) {
	    __extends(MDCCheckboxFoundation, _super);
	    function MDCCheckboxFoundation(adapter) {
	        var _this = _super.call(this, __assign(__assign({}, MDCCheckboxFoundation.defaultAdapter), adapter)) || this;
	        _this.currentCheckState = strings$4.TRANSITION_STATE_INIT;
	        _this.currentAnimationClass = '';
	        _this.animEndLatchTimer = 0;
	        _this.enableAnimationEndHandler = false;
	        return _this;
	    }
	    Object.defineProperty(MDCCheckboxFoundation, "cssClasses", {
	        get: function () {
	            return cssClasses$3;
	        },
	        enumerable: false,
	        configurable: true
	    });
	    Object.defineProperty(MDCCheckboxFoundation, "strings", {
	        get: function () {
	            return strings$4;
	        },
	        enumerable: false,
	        configurable: true
	    });
	    Object.defineProperty(MDCCheckboxFoundation, "numbers", {
	        get: function () {
	            return numbers;
	        },
	        enumerable: false,
	        configurable: true
	    });
	    Object.defineProperty(MDCCheckboxFoundation, "defaultAdapter", {
	        get: function () {
	            return {
	                addClass: function () { return undefined; },
	                forceLayout: function () { return undefined; },
	                hasNativeControl: function () { return false; },
	                isAttachedToDOM: function () { return false; },
	                isChecked: function () { return false; },
	                isIndeterminate: function () { return false; },
	                removeClass: function () { return undefined; },
	                removeNativeControlAttr: function () { return undefined; },
	                setNativeControlAttr: function () { return undefined; },
	                setNativeControlDisabled: function () { return undefined; },
	            };
	        },
	        enumerable: false,
	        configurable: true
	    });
	    MDCCheckboxFoundation.prototype.init = function () {
	        this.currentCheckState = this.determineCheckState();
	        this.updateAriaChecked();
	        this.adapter.addClass(cssClasses$3.UPGRADED);
	    };
	    MDCCheckboxFoundation.prototype.destroy = function () {
	        clearTimeout(this.animEndLatchTimer);
	    };
	    MDCCheckboxFoundation.prototype.setDisabled = function (disabled) {
	        this.adapter.setNativeControlDisabled(disabled);
	        if (disabled) {
	            this.adapter.addClass(cssClasses$3.DISABLED);
	        }
	        else {
	            this.adapter.removeClass(cssClasses$3.DISABLED);
	        }
	    };
	    /**
	     * Handles the animationend event for the checkbox
	     */
	    MDCCheckboxFoundation.prototype.handleAnimationEnd = function () {
	        var _this = this;
	        if (!this.enableAnimationEndHandler) {
	            return;
	        }
	        clearTimeout(this.animEndLatchTimer);
	        this.animEndLatchTimer = setTimeout(function () {
	            _this.adapter.removeClass(_this.currentAnimationClass);
	            _this.enableAnimationEndHandler = false;
	        }, numbers.ANIM_END_LATCH_MS);
	    };
	    /**
	     * Handles the change event for the checkbox
	     */
	    MDCCheckboxFoundation.prototype.handleChange = function () {
	        this.transitionCheckState();
	    };
	    MDCCheckboxFoundation.prototype.transitionCheckState = function () {
	        if (!this.adapter.hasNativeControl()) {
	            return;
	        }
	        var oldState = this.currentCheckState;
	        var newState = this.determineCheckState();
	        if (oldState === newState) {
	            return;
	        }
	        this.updateAriaChecked();
	        var TRANSITION_STATE_UNCHECKED = strings$4.TRANSITION_STATE_UNCHECKED;
	        var SELECTED = cssClasses$3.SELECTED;
	        if (newState === TRANSITION_STATE_UNCHECKED) {
	            this.adapter.removeClass(SELECTED);
	        }
	        else {
	            this.adapter.addClass(SELECTED);
	        }
	        // Check to ensure that there isn't a previously existing animation class, in case for example
	        // the user interacted with the checkbox before the animation was finished.
	        if (this.currentAnimationClass.length > 0) {
	            clearTimeout(this.animEndLatchTimer);
	            this.adapter.forceLayout();
	            this.adapter.removeClass(this.currentAnimationClass);
	        }
	        this.currentAnimationClass =
	            this.getTransitionAnimationClass(oldState, newState);
	        this.currentCheckState = newState;
	        // Check for parentNode so that animations are only run when the element is attached
	        // to the DOM.
	        if (this.adapter.isAttachedToDOM() &&
	            this.currentAnimationClass.length > 0) {
	            this.adapter.addClass(this.currentAnimationClass);
	            this.enableAnimationEndHandler = true;
	        }
	    };
	    MDCCheckboxFoundation.prototype.determineCheckState = function () {
	        var TRANSITION_STATE_INDETERMINATE = strings$4.TRANSITION_STATE_INDETERMINATE, TRANSITION_STATE_CHECKED = strings$4.TRANSITION_STATE_CHECKED, TRANSITION_STATE_UNCHECKED = strings$4.TRANSITION_STATE_UNCHECKED;
	        if (this.adapter.isIndeterminate()) {
	            return TRANSITION_STATE_INDETERMINATE;
	        }
	        return this.adapter.isChecked() ? TRANSITION_STATE_CHECKED :
	            TRANSITION_STATE_UNCHECKED;
	    };
	    MDCCheckboxFoundation.prototype.getTransitionAnimationClass = function (oldState, newState) {
	        var TRANSITION_STATE_INIT = strings$4.TRANSITION_STATE_INIT, TRANSITION_STATE_CHECKED = strings$4.TRANSITION_STATE_CHECKED, TRANSITION_STATE_UNCHECKED = strings$4.TRANSITION_STATE_UNCHECKED;
	        var _a = MDCCheckboxFoundation.cssClasses, ANIM_UNCHECKED_CHECKED = _a.ANIM_UNCHECKED_CHECKED, ANIM_UNCHECKED_INDETERMINATE = _a.ANIM_UNCHECKED_INDETERMINATE, ANIM_CHECKED_UNCHECKED = _a.ANIM_CHECKED_UNCHECKED, ANIM_CHECKED_INDETERMINATE = _a.ANIM_CHECKED_INDETERMINATE, ANIM_INDETERMINATE_CHECKED = _a.ANIM_INDETERMINATE_CHECKED, ANIM_INDETERMINATE_UNCHECKED = _a.ANIM_INDETERMINATE_UNCHECKED;
	        switch (oldState) {
	            case TRANSITION_STATE_INIT:
	                if (newState === TRANSITION_STATE_UNCHECKED) {
	                    return '';
	                }
	                return newState === TRANSITION_STATE_CHECKED ? ANIM_INDETERMINATE_CHECKED : ANIM_INDETERMINATE_UNCHECKED;
	            case TRANSITION_STATE_UNCHECKED:
	                return newState === TRANSITION_STATE_CHECKED ? ANIM_UNCHECKED_CHECKED : ANIM_UNCHECKED_INDETERMINATE;
	            case TRANSITION_STATE_CHECKED:
	                return newState === TRANSITION_STATE_UNCHECKED ? ANIM_CHECKED_UNCHECKED : ANIM_CHECKED_INDETERMINATE;
	            default: // TRANSITION_STATE_INDETERMINATE
	                return newState === TRANSITION_STATE_CHECKED ? ANIM_INDETERMINATE_CHECKED : ANIM_INDETERMINATE_UNCHECKED;
	        }
	    };
	    MDCCheckboxFoundation.prototype.updateAriaChecked = function () {
	        // Ensure aria-checked is set to mixed if checkbox is in indeterminate state.
	        if (this.adapter.isIndeterminate()) {
	            this.adapter.setNativeControlAttr(strings$4.ARIA_CHECKED_ATTR, strings$4.ARIA_CHECKED_INDETERMINATE_VALUE);
	        }
	        else {
	            // The on/off state does not need to keep track of aria-checked, since
	            // the screenreader uses the checked property on the checkbox element.
	            this.adapter.removeNativeControlAttr(strings$4.ARIA_CHECKED_ATTR);
	        }
	    };
	    return MDCCheckboxFoundation;
	}(MDCFoundation));

	/* node_modules/@smui/checkbox/dist/Checkbox.svelte generated by Svelte v4.2.7 */

	function create_fragment$a(ctx) {
		let div3;
		let input;
		let input_class_value;
		let input_value_value;
		let input_data_indeterminate_value;
		let useActions_action;
		let t0;
		let div1;
		let t2;
		let div2;
		let div3_class_value;
		let div3_style_value;
		let useActions_action_1;
		let Ripple_action;
		let mounted;
		let dispose;

		let input_levels = [
			{
				class: input_class_value = classMap({
					[/*input$class*/ ctx[9]]: true,
					'mdc-checkbox__native-control': true
				})
			},
			{ type: "checkbox" },
			/*inputProps*/ ctx[20],
			{ disabled: /*disabled*/ ctx[1] },
			{
				__value: input_value_value = /*isUninitializedValue*/ ctx[19](/*valueKey*/ ctx[7])
				? /*value*/ ctx[6]
				: /*valueKey*/ ctx[7]
			},
			{
				"data-indeterminate": input_data_indeterminate_value = !/*isUninitializedValue*/ ctx[19](/*indeterminate*/ ctx[0]) && /*indeterminate*/ ctx[0]
				? 'true'
				: undefined
			},
			/*nativeControlAttrs*/ ctx[16],
			prefixFilter(/*$$restProps*/ ctx[26], 'input$')
		];

		let input_data = {};

		for (let i = 0; i < input_levels.length; i += 1) {
			input_data = assign(input_data, input_levels[i]);
		}

		let div3_levels = [
			{
				class: div3_class_value = classMap({
					[/*className*/ ctx[3]]: true,
					'mdc-checkbox': true,
					'mdc-checkbox--disabled': /*disabled*/ ctx[1],
					'mdc-checkbox--touch': /*touch*/ ctx[5],
					'mdc-data-table__header-row-checkbox': /*context*/ ctx[21] === 'data-table' && /*dataTableHeader*/ ctx[22],
					'mdc-data-table__row-checkbox': /*context*/ ctx[21] === 'data-table' && !/*dataTableHeader*/ ctx[22],
					.../*internalClasses*/ ctx[14]
				})
			},
			{
				style: div3_style_value = Object.entries(/*internalStyles*/ ctx[15]).map(func$2).concat([/*style*/ ctx[4]]).join(' ')
			},
			exclude(/*$$restProps*/ ctx[26], ['input$'])
		];

		let div_data_3 = {};

		for (let i = 0; i < div3_levels.length; i += 1) {
			div_data_3 = assign(div_data_3, div3_levels[i]);
		}

		return {
			c() {
				div3 = element("div");
				input = element("input");
				t0 = space();
				div1 = element("div");
				div1.innerHTML = `<svg class="mdc-checkbox__checkmark" viewBox="0 0 24 24"><path class="mdc-checkbox__checkmark-path" fill="none" d="M1.73,12.91 8.1,19.28 22.79,4.59"></path></svg> <div class="mdc-checkbox__mixedmark"></div>`;
				t2 = space();
				div2 = element("div");
				set_attributes(input, input_data);
				attr(div1, "class", "mdc-checkbox__background");
				attr(div2, "class", "mdc-checkbox__ripple");
				set_attributes(div3, div_data_3);
			},
			m(target, anchor) {
				insert(target, div3, anchor);
				append(div3, input);
				if (input.autofocus) input.focus();
				/*input_binding*/ ctx[36](input);
				input.checked = /*nativeChecked*/ ctx[12];
				append(div3, t0);
				append(div3, div1);
				append(div3, t2);
				append(div3, div2);
				/*div3_binding*/ ctx[38](div3);

				if (!mounted) {
					dispose = [
						action_destroyer(useActions_action = useActions.call(null, input, /*input$use*/ ctx[8])),
						listen$1(input, "change", /*input_change_handler*/ ctx[37]),
						listen$1(input, "blur", /*blur_handler*/ ctx[34]),
						listen$1(input, "focus", /*focus_handler*/ ctx[35]),
						action_destroyer(useActions_action_1 = useActions.call(null, div3, /*use*/ ctx[2])),
						action_destroyer(/*forwardEvents*/ ctx[18].call(null, div3)),
						action_destroyer(Ripple_action = Ripple.call(null, div3, {
							unbounded: true,
							addClass: /*addClass*/ ctx[23],
							removeClass: /*removeClass*/ ctx[24],
							addStyle: /*addStyle*/ ctx[25],
							active: /*rippleActive*/ ctx[17],
							eventTarget: /*checkbox*/ ctx[11]
						})),
						listen$1(div3, "animationend", /*animationend_handler*/ ctx[39])
					];

					mounted = true;
				}
			},
			p(ctx, dirty) {
				set_attributes(input, input_data = get_spread_update(input_levels, [
					dirty[0] & /*input$class*/ 512 && input_class_value !== (input_class_value = classMap({
						[/*input$class*/ ctx[9]]: true,
						'mdc-checkbox__native-control': true
					})) && { class: input_class_value },
					{ type: "checkbox" },
					/*inputProps*/ ctx[20],
					dirty[0] & /*disabled*/ 2 && { disabled: /*disabled*/ ctx[1] },
					dirty[0] & /*valueKey, value*/ 192 && input_value_value !== (input_value_value = /*isUninitializedValue*/ ctx[19](/*valueKey*/ ctx[7])
					? /*value*/ ctx[6]
					: /*valueKey*/ ctx[7]) && { __value: input_value_value },
					dirty[0] & /*indeterminate*/ 1 && input_data_indeterminate_value !== (input_data_indeterminate_value = !/*isUninitializedValue*/ ctx[19](/*indeterminate*/ ctx[0]) && /*indeterminate*/ ctx[0]
					? 'true'
					: undefined) && {
						"data-indeterminate": input_data_indeterminate_value
					},
					dirty[0] & /*nativeControlAttrs*/ 65536 && /*nativeControlAttrs*/ ctx[16],
					dirty[0] & /*$$restProps*/ 67108864 && prefixFilter(/*$$restProps*/ ctx[26], 'input$')
				]));

				if (useActions_action && is_function(useActions_action.update) && dirty[0] & /*input$use*/ 256) useActions_action.update.call(null, /*input$use*/ ctx[8]);

				if (dirty[0] & /*nativeChecked*/ 4096) {
					input.checked = /*nativeChecked*/ ctx[12];
				}

				set_attributes(div3, div_data_3 = get_spread_update(div3_levels, [
					dirty[0] & /*className, disabled, touch, internalClasses*/ 16426 && div3_class_value !== (div3_class_value = classMap({
						[/*className*/ ctx[3]]: true,
						'mdc-checkbox': true,
						'mdc-checkbox--disabled': /*disabled*/ ctx[1],
						'mdc-checkbox--touch': /*touch*/ ctx[5],
						'mdc-data-table__header-row-checkbox': /*context*/ ctx[21] === 'data-table' && /*dataTableHeader*/ ctx[22],
						'mdc-data-table__row-checkbox': /*context*/ ctx[21] === 'data-table' && !/*dataTableHeader*/ ctx[22],
						.../*internalClasses*/ ctx[14]
					})) && { class: div3_class_value },
					dirty[0] & /*internalStyles, style*/ 32784 && div3_style_value !== (div3_style_value = Object.entries(/*internalStyles*/ ctx[15]).map(func$2).concat([/*style*/ ctx[4]]).join(' ')) && { style: div3_style_value },
					dirty[0] & /*$$restProps*/ 67108864 && exclude(/*$$restProps*/ ctx[26], ['input$'])
				]));

				if (useActions_action_1 && is_function(useActions_action_1.update) && dirty[0] & /*use*/ 4) useActions_action_1.update.call(null, /*use*/ ctx[2]);

				if (Ripple_action && is_function(Ripple_action.update) && dirty[0] & /*rippleActive, checkbox*/ 133120) Ripple_action.update.call(null, {
					unbounded: true,
					addClass: /*addClass*/ ctx[23],
					removeClass: /*removeClass*/ ctx[24],
					addStyle: /*addStyle*/ ctx[25],
					active: /*rippleActive*/ ctx[17],
					eventTarget: /*checkbox*/ ctx[11]
				});
			},
			i: noop,
			o: noop,
			d(detaching) {
				if (detaching) {
					detach(div3);
				}

				/*input_binding*/ ctx[36](null);
				/*div3_binding*/ ctx[38](null);
				mounted = false;
				run_all(dispose);
			}
		};
	}

	const func$2 = ([name, value]) => `${name}: ${value};`;

	function instance_1$3($$self, $$props, $$invalidate) {
		const omit_props_names = [
			"use","class","style","disabled","touch","indeterminate","group","checked","value","valueKey","input$use","input$class","getId","getElement"
		];

		let $$restProps = compute_rest_props($$props, omit_props_names);
		var _a;
		const forwardEvents = forwardEventsBuilder(get_current_component());

		let uninitializedValue = () => {
			
		};

		function isUninitializedValue(value) {
			return value === uninitializedValue;
		}

		let { use = [] } = $$props;
		let { class: className = '' } = $$props;
		let { style = '' } = $$props;
		let { disabled = false } = $$props;
		let { touch = false } = $$props;
		let { indeterminate = uninitializedValue } = $$props;
		let { group = uninitializedValue } = $$props;
		let { checked = uninitializedValue } = $$props;
		let { value = null } = $$props;
		let { valueKey = uninitializedValue } = $$props;
		let { input$use = [] } = $$props;
		let { input$class = '' } = $$props;
		let element;
		let instance;
		let checkbox;
		let internalClasses = {};
		let internalStyles = {};
		let nativeControlAttrs = {};
		let rippleActive = false;

		let inputProps = (_a = getContext('SMUI:generic:input:props')) !== null && _a !== void 0
		? _a
		: {};

		let nativeChecked = isUninitializedValue(group)
		? isUninitializedValue(checked)
			? false
			: checked !== null && checked !== void 0
				? checked
				: undefined
		: group.indexOf(value) !== -1;

		let context = getContext('SMUI:checkbox:context');
		let dataTableHeader = getContext('SMUI:data-table:row:header');
		let previousChecked = checked;
		let previousGroup = isUninitializedValue(group) ? [] : [...group];
		let previousNativeChecked = nativeChecked;

		onMount(() => {
			$$invalidate(11, checkbox.indeterminate = !isUninitializedValue(indeterminate) && indeterminate, checkbox);

			$$invalidate(10, instance = new MDCCheckboxFoundation({
					addClass,
					forceLayout: () => element.offsetWidth,
					hasNativeControl: () => true,
					isAttachedToDOM: () => Boolean(element.parentNode),
					isChecked: () => nativeChecked !== null && nativeChecked !== void 0
					? nativeChecked
					: false,
					isIndeterminate: () => isUninitializedValue(indeterminate)
					? false
					: indeterminate,
					removeClass,
					removeNativeControlAttr,
					setNativeControlAttr: addNativeControlAttr,
					setNativeControlDisabled: value => $$invalidate(1, disabled = value)
				}));

			const accessor = {
				_smui_checkbox_accessor: true,
				get element() {
					return getElement();
				},
				get checked() {
					return nativeChecked !== null && nativeChecked !== void 0
					? nativeChecked
					: false;
				},
				set checked(value) {
					if (nativeChecked !== value) {
						$$invalidate(12, nativeChecked = value);
					}
				},
				get indeterminate() {
					return isUninitializedValue(indeterminate)
					? false
					: indeterminate;
				},
				set indeterminate(value) {
					$$invalidate(0, indeterminate = value);
				},
				activateRipple() {
					if (!disabled) {
						$$invalidate(17, rippleActive = true);
					}
				},
				deactivateRipple() {
					$$invalidate(17, rippleActive = false);
				}
			};

			dispatch(element, 'SMUIGenericInput:mount', accessor);
			dispatch(element, 'SMUICheckbox:mount', accessor);
			instance.init();

			return () => {
				dispatch(element, 'SMUIGenericInput:unmount', accessor);
				dispatch(element, 'SMUICheckbox:unmount', accessor);
				instance.destroy();
			};
		});

		function addClass(className) {
			if (!internalClasses[className]) {
				$$invalidate(14, internalClasses[className] = true, internalClasses);
			}
		}

		function removeClass(className) {
			if (!(className in internalClasses) || internalClasses[className]) {
				$$invalidate(14, internalClasses[className] = false, internalClasses);
			}
		}

		function addStyle(name, value) {
			if (internalStyles[name] != value) {
				if (value === '' || value == null) {
					delete internalStyles[name];
					$$invalidate(15, internalStyles);
				} else {
					$$invalidate(15, internalStyles[name] = value, internalStyles);
				}
			}
		}

		function addNativeControlAttr(name, value) {
			if (nativeControlAttrs[name] !== value) {
				$$invalidate(16, nativeControlAttrs[name] = value, nativeControlAttrs);
			}
		}

		function removeNativeControlAttr(name) {
			if (!(name in nativeControlAttrs) || nativeControlAttrs[name] != null) {
				$$invalidate(16, nativeControlAttrs[name] = undefined, nativeControlAttrs);
			}
		}

		function getId() {
			return inputProps && inputProps.id;
		}

		function getElement() {
			return element;
		}

		function blur_handler(event) {
			bubble.call(this, $$self, event);
		}

		function focus_handler(event) {
			bubble.call(this, $$self, event);
		}

		function input_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				checkbox = $$value;
				((((((((($$invalidate(11, checkbox), $$invalidate(27, group)), $$invalidate(33, previousNativeChecked)), $$invalidate(12, nativeChecked)), $$invalidate(6, value)), $$invalidate(32, previousGroup)), $$invalidate(28, checked)), $$invalidate(31, previousChecked)), $$invalidate(0, indeterminate)), $$invalidate(10, instance));
			});
		}

		function input_change_handler() {
			nativeChecked = this.checked;
			((((((((($$invalidate(12, nativeChecked), $$invalidate(27, group)), $$invalidate(33, previousNativeChecked)), $$invalidate(6, value)), $$invalidate(32, previousGroup)), $$invalidate(28, checked)), $$invalidate(31, previousChecked)), $$invalidate(0, indeterminate)), $$invalidate(11, checkbox)), $$invalidate(10, instance));
		}

		function div3_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				element = $$value;
				$$invalidate(13, element);
			});
		}

		const animationend_handler = () => instance && instance.handleAnimationEnd();

		$$self.$$set = $$new_props => {
			$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
			$$invalidate(26, $$restProps = compute_rest_props($$props, omit_props_names));
			if ('use' in $$new_props) $$invalidate(2, use = $$new_props.use);
			if ('class' in $$new_props) $$invalidate(3, className = $$new_props.class);
			if ('style' in $$new_props) $$invalidate(4, style = $$new_props.style);
			if ('disabled' in $$new_props) $$invalidate(1, disabled = $$new_props.disabled);
			if ('touch' in $$new_props) $$invalidate(5, touch = $$new_props.touch);
			if ('indeterminate' in $$new_props) $$invalidate(0, indeterminate = $$new_props.indeterminate);
			if ('group' in $$new_props) $$invalidate(27, group = $$new_props.group);
			if ('checked' in $$new_props) $$invalidate(28, checked = $$new_props.checked);
			if ('value' in $$new_props) $$invalidate(6, value = $$new_props.value);
			if ('valueKey' in $$new_props) $$invalidate(7, valueKey = $$new_props.valueKey);
			if ('input$use' in $$new_props) $$invalidate(8, input$use = $$new_props.input$use);
			if ('input$class' in $$new_props) $$invalidate(9, input$class = $$new_props.input$class);
		};

		$$self.$$.update = () => {
			if ($$self.$$.dirty[0] & /*group, nativeChecked, value, checked, indeterminate, checkbox, instance*/ 402660417 | $$self.$$.dirty[1] & /*previousNativeChecked, previousGroup, previousChecked*/ 7) {
				{
					// This is a substitute for an on:change listener that is
					// smarter about when it calls the instance's handler. I do
					// this so that a group of changes will only trigger one
					// handler call, since the handler will reset currently
					// running animations.
					let callHandleChange = false;

					// First check for group state.
					if (!isUninitializedValue(group)) {
						if (previousNativeChecked !== nativeChecked) {
							// The change needs to flow up.
							const idx = group.indexOf(value);

							if (nativeChecked && idx === -1) {
								group.push(value);
								((((((((($$invalidate(27, group), $$invalidate(33, previousNativeChecked)), $$invalidate(12, nativeChecked)), $$invalidate(6, value)), $$invalidate(32, previousGroup)), $$invalidate(28, checked)), $$invalidate(31, previousChecked)), $$invalidate(0, indeterminate)), $$invalidate(11, checkbox)), $$invalidate(10, instance));
							} else if (!nativeChecked && idx !== -1) {
								group.splice(idx, 1);
								((((((((($$invalidate(27, group), $$invalidate(33, previousNativeChecked)), $$invalidate(12, nativeChecked)), $$invalidate(6, value)), $$invalidate(32, previousGroup)), $$invalidate(28, checked)), $$invalidate(31, previousChecked)), $$invalidate(0, indeterminate)), $$invalidate(11, checkbox)), $$invalidate(10, instance));
							}

							callHandleChange = true;
						} else {
							// Potential changes need to flow down.
							const idxPrev = previousGroup.indexOf(value);

							const idx = group.indexOf(value);

							if (idxPrev > -1 && idx === -1) {
								// The checkbox was removed from the group.
								$$invalidate(12, nativeChecked = false);

								callHandleChange = true;
							} else if (idx > -1 && idxPrev === -1) {
								// The checkbox was added to the group.
								$$invalidate(12, nativeChecked = true);

								callHandleChange = true;
							}
						}
					}

					// Now check individual state.
					if (isUninitializedValue(checked)) {
						if (!!previousNativeChecked !== !!nativeChecked) {
							// The checkbox was clicked by the user.
							callHandleChange = true;
						}
					} else if (checked !== (nativeChecked !== null && nativeChecked !== void 0
					? nativeChecked
					: null)) {
						if (checked === previousChecked) {
							// The checkbox was clicked by the user
							// and the change needs to flow up.
							$$invalidate(28, checked = nativeChecked !== null && nativeChecked !== void 0
							? nativeChecked
							: null);

							if (!isUninitializedValue(indeterminate)) {
								$$invalidate(0, indeterminate = false);
							}
						} else {
							// The checkbox was changed programmatically
							// and the change needs to flow down.
							$$invalidate(12, nativeChecked = checked !== null && checked !== void 0
							? checked
							: undefined);
						}

						callHandleChange = true;
					}

					if (checkbox) {
						// Sync indeterminate state with the native input.
						if (isUninitializedValue(indeterminate)) {
							if (checkbox.indeterminate) {
								// I don't think this can happen, but just in case.
								$$invalidate(11, checkbox.indeterminate = false, checkbox);

								callHandleChange = true;
							}
						} else {
							if (!indeterminate && checkbox.indeterminate) {
								$$invalidate(11, checkbox.indeterminate = false, checkbox);
								callHandleChange = true;
							} else if (indeterminate && !checkbox.indeterminate) {
								$$invalidate(11, checkbox.indeterminate = true, checkbox);
								callHandleChange = true;
							}
						}
					}

					$$invalidate(31, previousChecked = checked);
					$$invalidate(32, previousGroup = isUninitializedValue(group) ? [] : [...group]);
					$$invalidate(33, previousNativeChecked = nativeChecked);

					if (callHandleChange && instance) {
						instance.handleChange();
					}
				}
			}
		};

		return [
			indeterminate,
			disabled,
			use,
			className,
			style,
			touch,
			value,
			valueKey,
			input$use,
			input$class,
			instance,
			checkbox,
			nativeChecked,
			element,
			internalClasses,
			internalStyles,
			nativeControlAttrs,
			rippleActive,
			forwardEvents,
			isUninitializedValue,
			inputProps,
			context,
			dataTableHeader,
			addClass,
			removeClass,
			addStyle,
			$$restProps,
			group,
			checked,
			getId,
			getElement,
			previousChecked,
			previousGroup,
			previousNativeChecked,
			blur_handler,
			focus_handler,
			input_binding,
			input_change_handler,
			div3_binding,
			animationend_handler
		];
	}

	class Checkbox extends SvelteComponent {
		constructor(options) {
			super();

			init(
				this,
				options,
				instance_1$3,
				create_fragment$a,
				safe_not_equal,
				{
					use: 2,
					class: 3,
					style: 4,
					disabled: 1,
					touch: 5,
					indeterminate: 0,
					group: 27,
					checked: 28,
					value: 6,
					valueKey: 7,
					input$use: 8,
					input$class: 9,
					getId: 29,
					getElement: 30
				},
				null,
				[-1, -1]
			);
		}

		get getId() {
			return this.$$.ctx[29];
		}

		get getElement() {
			return this.$$.ctx[30];
		}
	}

	/**
	 * @license
	 * Copyright 2020 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */
	/**
	 * Priorities for the announce function.
	 */
	var AnnouncerPriority;
	(function (AnnouncerPriority) {
	    AnnouncerPriority["POLITE"] = "polite";
	    AnnouncerPriority["ASSERTIVE"] = "assertive";
	})(AnnouncerPriority || (AnnouncerPriority = {}));
	/**
	 * Data attribute added to live region element.
	 */
	var DATA_MDC_DOM_ANNOUNCE = 'data-mdc-dom-announce';
	/**
	 * Announces the given message with optional priority, defaulting to "polite"
	 */
	function announce(message, options) {
	    Announcer.getInstance().say(message, options);
	}
	var Announcer = /** @class */ (function () {
	    // Constructor made private to ensure only the singleton is used
	    function Announcer() {
	        this.liveRegions = new Map();
	    }
	    Announcer.getInstance = function () {
	        if (!Announcer.instance) {
	            Announcer.instance = new Announcer();
	        }
	        return Announcer.instance;
	    };
	    Announcer.prototype.say = function (message, options) {
	        var _a, _b;
	        var priority = (_a = options === null || options === void 0 ? void 0 : options.priority) !== null && _a !== void 0 ? _a : AnnouncerPriority.POLITE;
	        var ownerDocument = (_b = options === null || options === void 0 ? void 0 : options.ownerDocument) !== null && _b !== void 0 ? _b : document;
	        var liveRegion = this.getLiveRegion(priority, ownerDocument);
	        // Reset the region to pick up the message, even if the message is the
	        // exact same as before.
	        liveRegion.textContent = '';
	        // Timeout is necessary for screen readers like NVDA and VoiceOver.
	        setTimeout(function () {
	            liveRegion.textContent = message;
	            ownerDocument.addEventListener('click', clearLiveRegion);
	        }, 1);
	        function clearLiveRegion() {
	            liveRegion.textContent = '';
	            ownerDocument.removeEventListener('click', clearLiveRegion);
	        }
	    };
	    Announcer.prototype.getLiveRegion = function (priority, ownerDocument) {
	        var documentLiveRegions = this.liveRegions.get(ownerDocument);
	        if (!documentLiveRegions) {
	            documentLiveRegions = new Map();
	            this.liveRegions.set(ownerDocument, documentLiveRegions);
	        }
	        var existingLiveRegion = documentLiveRegions.get(priority);
	        if (existingLiveRegion &&
	            ownerDocument.body.contains(existingLiveRegion)) {
	            return existingLiveRegion;
	        }
	        var liveRegion = this.createLiveRegion(priority, ownerDocument);
	        documentLiveRegions.set(priority, liveRegion);
	        return liveRegion;
	    };
	    Announcer.prototype.createLiveRegion = function (priority, ownerDocument) {
	        var el = ownerDocument.createElement('div');
	        el.style.position = 'absolute';
	        el.style.top = '-9999px';
	        el.style.left = '-9999px';
	        el.style.height = '1px';
	        el.style.overflow = 'hidden';
	        el.setAttribute('aria-atomic', 'true');
	        el.setAttribute('aria-live', priority);
	        el.setAttribute(DATA_MDC_DOM_ANNOUNCE, 'true');
	        ownerDocument.body.appendChild(el);
	        return el;
	    };
	    return Announcer;
	}());

	/**
	 * @license
	 * Copyright 2020 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */
	var InteractionTrigger;
	(function (InteractionTrigger) {
	    InteractionTrigger[InteractionTrigger["UNSPECIFIED"] = 0] = "UNSPECIFIED";
	    InteractionTrigger[InteractionTrigger["CLICK"] = 1] = "CLICK";
	    InteractionTrigger[InteractionTrigger["BACKSPACE_KEY"] = 2] = "BACKSPACE_KEY";
	    InteractionTrigger[InteractionTrigger["DELETE_KEY"] = 3] = "DELETE_KEY";
	    InteractionTrigger[InteractionTrigger["SPACEBAR_KEY"] = 4] = "SPACEBAR_KEY";
	    InteractionTrigger[InteractionTrigger["ENTER_KEY"] = 5] = "ENTER_KEY";
	})(InteractionTrigger || (InteractionTrigger = {}));
	var strings$3 = {
	    ARIA_HIDDEN: 'aria-hidden',
	    INTERACTION_EVENT: 'MDCChipTrailingAction:interaction',
	    NAVIGATION_EVENT: 'MDCChipTrailingAction:navigation',
	    TAB_INDEX: 'tabindex',
	};

	/**
	 * @license
	 * Copyright 2020 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */
	var MDCChipTrailingActionFoundation = /** @class */ (function (_super) {
	    __extends(MDCChipTrailingActionFoundation, _super);
	    function MDCChipTrailingActionFoundation(adapter) {
	        return _super.call(this, __assign(__assign({}, MDCChipTrailingActionFoundation.defaultAdapter), adapter)) || this;
	    }
	    Object.defineProperty(MDCChipTrailingActionFoundation, "strings", {
	        get: function () {
	            return strings$3;
	        },
	        enumerable: false,
	        configurable: true
	    });
	    Object.defineProperty(MDCChipTrailingActionFoundation, "defaultAdapter", {
	        get: function () {
	            return {
	                focus: function () { return undefined; },
	                getAttribute: function () { return null; },
	                setAttribute: function () { return undefined; },
	                notifyInteraction: function () { return undefined; },
	                notifyNavigation: function () { return undefined; },
	            };
	        },
	        enumerable: false,
	        configurable: true
	    });
	    MDCChipTrailingActionFoundation.prototype.handleClick = function (evt) {
	        evt.stopPropagation();
	        this.adapter.notifyInteraction(InteractionTrigger.CLICK);
	    };
	    MDCChipTrailingActionFoundation.prototype.handleKeydown = function (evt) {
	        evt.stopPropagation();
	        var key = normalizeKey(evt);
	        if (this.shouldNotifyInteractionFromKey(key)) {
	            var trigger = this.getTriggerFromKey(key);
	            this.adapter.notifyInteraction(trigger);
	            return;
	        }
	        if (isNavigationEvent(evt)) {
	            this.adapter.notifyNavigation(key);
	            return;
	        }
	    };
	    MDCChipTrailingActionFoundation.prototype.removeFocus = function () {
	        this.adapter.setAttribute(strings$3.TAB_INDEX, '-1');
	    };
	    MDCChipTrailingActionFoundation.prototype.focus = function () {
	        this.adapter.setAttribute(strings$3.TAB_INDEX, '0');
	        this.adapter.focus();
	    };
	    MDCChipTrailingActionFoundation.prototype.isNavigable = function () {
	        return this.adapter.getAttribute(strings$3.ARIA_HIDDEN) !== 'true';
	    };
	    MDCChipTrailingActionFoundation.prototype.shouldNotifyInteractionFromKey = function (key) {
	        var isFromActionKey = key === KEY.ENTER || key === KEY.SPACEBAR;
	        var isFromDeleteKey = key === KEY.BACKSPACE || key === KEY.DELETE;
	        return isFromActionKey || isFromDeleteKey;
	    };
	    MDCChipTrailingActionFoundation.prototype.getTriggerFromKey = function (key) {
	        if (key === KEY.SPACEBAR) {
	            return InteractionTrigger.SPACEBAR_KEY;
	        }
	        if (key === KEY.ENTER) {
	            return InteractionTrigger.ENTER_KEY;
	        }
	        if (key === KEY.DELETE) {
	            return InteractionTrigger.DELETE_KEY;
	        }
	        if (key === KEY.BACKSPACE) {
	            return InteractionTrigger.BACKSPACE_KEY;
	        }
	        // Default case, should never be returned
	        return InteractionTrigger.UNSPECIFIED;
	    };
	    return MDCChipTrailingActionFoundation;
	}(MDCFoundation));

	/**
	 * @license
	 * Copyright 2020 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */
	var MDCChipTrailingAction = /** @class */ (function (_super) {
	    __extends(MDCChipTrailingAction, _super);
	    function MDCChipTrailingAction() {
	        return _super !== null && _super.apply(this, arguments) || this;
	    }
	    Object.defineProperty(MDCChipTrailingAction.prototype, "ripple", {
	        get: function () {
	            return this.rippleSurface;
	        },
	        enumerable: false,
	        configurable: true
	    });
	    MDCChipTrailingAction.attachTo = function (root) {
	        return new MDCChipTrailingAction(root);
	    };
	    MDCChipTrailingAction.prototype.initialize = function (rippleFactory) {
	        if (rippleFactory === void 0) { rippleFactory = function (el, foundation) {
	            return new MDCRipple(el, foundation);
	        }; }
	        // DO NOT INLINE this variable. For backward compatibility, foundations take
	        // a Partial<MDCFooAdapter>. To ensure we don't accidentally omit any
	        // methods, we need a separate, strongly typed adapter variable.
	        var rippleAdapter = MDCRipple.createAdapter(this);
	        this.rippleSurface =
	            rippleFactory(this.root, new MDCRippleFoundation(rippleAdapter));
	    };
	    MDCChipTrailingAction.prototype.initialSyncWithDOM = function () {
	        var _this = this;
	        this.handleClick = function (evt) {
	            _this.foundation.handleClick(evt);
	        };
	        this.handleKeydown = function (evt) {
	            _this.foundation.handleKeydown(evt);
	        };
	        this.listen('click', this.handleClick);
	        this.listen('keydown', this.handleKeydown);
	    };
	    MDCChipTrailingAction.prototype.destroy = function () {
	        this.rippleSurface.destroy();
	        this.unlisten('click', this.handleClick);
	        this.unlisten('keydown', this.handleKeydown);
	        _super.prototype.destroy.call(this);
	    };
	    MDCChipTrailingAction.prototype.getDefaultFoundation = function () {
	        var _this = this;
	        // DO NOT INLINE this variable. For backward compatibility, foundations take
	        // a Partial<MDCFooAdapter>. To ensure we don't accidentally omit any
	        // methods, we need a separate, strongly typed adapter variable.
	        var adapter = {
	            focus: function () {
	                // TODO(b/157231863): Migate MDCComponent#root to HTMLElement
	                _this.root.focus();
	            },
	            getAttribute: function (attr) { return _this.root.getAttribute(attr); },
	            notifyInteraction: function (trigger) {
	                return _this.emit(strings$3.INTERACTION_EVENT, { trigger: trigger }, true /* shouldBubble */);
	            },
	            notifyNavigation: function (key) {
	                _this.emit(strings$3.NAVIGATION_EVENT, { key: key }, true /* shouldBubble */);
	            },
	            setAttribute: function (attr, value) {
	                _this.root.setAttribute(attr, value);
	            },
	        };
	        return new MDCChipTrailingActionFoundation(adapter);
	    };
	    MDCChipTrailingAction.prototype.isNavigable = function () {
	        return this.foundation.isNavigable();
	    };
	    MDCChipTrailingAction.prototype.focus = function () {
	        this.foundation.focus();
	    };
	    MDCChipTrailingAction.prototype.removeFocus = function () {
	        this.foundation.removeFocus();
	    };
	    return MDCChipTrailingAction;
	}(MDCComponent));

	/**
	 * @license
	 * Copyright 2016 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */
	var Direction;
	(function (Direction) {
	    Direction["LEFT"] = "left";
	    Direction["RIGHT"] = "right";
	})(Direction || (Direction = {}));
	var EventSource;
	(function (EventSource) {
	    EventSource["PRIMARY"] = "primary";
	    EventSource["TRAILING"] = "trailing";
	    EventSource["NONE"] = "none";
	})(EventSource || (EventSource = {}));
	var strings$2 = {
	    ADDED_ANNOUNCEMENT_ATTRIBUTE: 'data-mdc-chip-added-announcement',
	    ARIA_CHECKED: 'aria-checked',
	    ARROW_DOWN_KEY: 'ArrowDown',
	    ARROW_LEFT_KEY: 'ArrowLeft',
	    ARROW_RIGHT_KEY: 'ArrowRight',
	    ARROW_UP_KEY: 'ArrowUp',
	    BACKSPACE_KEY: 'Backspace',
	    CHECKMARK_SELECTOR: '.mdc-chip__checkmark',
	    DELETE_KEY: 'Delete',
	    END_KEY: 'End',
	    ENTER_KEY: 'Enter',
	    ENTRY_ANIMATION_NAME: 'mdc-chip-entry',
	    HOME_KEY: 'Home',
	    IE_ARROW_DOWN_KEY: 'Down',
	    IE_ARROW_LEFT_KEY: 'Left',
	    IE_ARROW_RIGHT_KEY: 'Right',
	    IE_ARROW_UP_KEY: 'Up',
	    IE_DELETE_KEY: 'Del',
	    INTERACTION_EVENT: 'MDCChip:interaction',
	    LEADING_ICON_SELECTOR: '.mdc-chip__icon--leading',
	    NAVIGATION_EVENT: 'MDCChip:navigation',
	    PRIMARY_ACTION_SELECTOR: '.mdc-chip__primary-action',
	    REMOVED_ANNOUNCEMENT_ATTRIBUTE: 'data-mdc-chip-removed-announcement',
	    REMOVAL_EVENT: 'MDCChip:removal',
	    SELECTION_EVENT: 'MDCChip:selection',
	    SPACEBAR_KEY: ' ',
	    TAB_INDEX: 'tabindex',
	    TRAILING_ACTION_SELECTOR: '.mdc-chip-trailing-action',
	    TRAILING_ICON_INTERACTION_EVENT: 'MDCChip:trailingIconInteraction',
	    TRAILING_ICON_SELECTOR: '.mdc-chip__icon--trailing',
	};
	var cssClasses$2 = {
	    CHECKMARK: 'mdc-chip__checkmark',
	    CHIP_EXIT: 'mdc-chip--exit',
	    DELETABLE: 'mdc-chip--deletable',
	    EDITABLE: 'mdc-chip--editable',
	    EDITING: 'mdc-chip--editing',
	    HIDDEN_LEADING_ICON: 'mdc-chip__icon--leading-hidden',
	    LEADING_ICON: 'mdc-chip__icon--leading',
	    PRIMARY_ACTION: 'mdc-chip__primary-action',
	    PRIMARY_ACTION_FOCUSED: 'mdc-chip--primary-action-focused',
	    SELECTED: 'mdc-chip--selected',
	    TEXT: 'mdc-chip__text',
	    TRAILING_ACTION: 'mdc-chip__trailing-action',
	    TRAILING_ICON: 'mdc-chip__icon--trailing',
	};
	var navigationKeys = new Set();
	// IE11 has no support for new Set with iterable so we need to initialize this by hand
	navigationKeys.add(strings$2.ARROW_LEFT_KEY);
	navigationKeys.add(strings$2.ARROW_RIGHT_KEY);
	navigationKeys.add(strings$2.ARROW_DOWN_KEY);
	navigationKeys.add(strings$2.ARROW_UP_KEY);
	navigationKeys.add(strings$2.END_KEY);
	navigationKeys.add(strings$2.HOME_KEY);
	navigationKeys.add(strings$2.IE_ARROW_LEFT_KEY);
	navigationKeys.add(strings$2.IE_ARROW_RIGHT_KEY);
	navigationKeys.add(strings$2.IE_ARROW_DOWN_KEY);
	navigationKeys.add(strings$2.IE_ARROW_UP_KEY);
	var jumpChipKeys = new Set();
	// IE11 has no support for new Set with iterable so we need to initialize this by hand
	jumpChipKeys.add(strings$2.ARROW_UP_KEY);
	jumpChipKeys.add(strings$2.ARROW_DOWN_KEY);
	jumpChipKeys.add(strings$2.HOME_KEY);
	jumpChipKeys.add(strings$2.END_KEY);
	jumpChipKeys.add(strings$2.IE_ARROW_UP_KEY);
	jumpChipKeys.add(strings$2.IE_ARROW_DOWN_KEY);

	/**
	 * @license
	 * Copyright 2016 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */
	var emptyClientRect = {
	    bottom: 0,
	    height: 0,
	    left: 0,
	    right: 0,
	    top: 0,
	    width: 0,
	};
	var FocusBehavior;
	(function (FocusBehavior) {
	    FocusBehavior[FocusBehavior["SHOULD_FOCUS"] = 0] = "SHOULD_FOCUS";
	    FocusBehavior[FocusBehavior["SHOULD_NOT_FOCUS"] = 1] = "SHOULD_NOT_FOCUS";
	})(FocusBehavior || (FocusBehavior = {}));
	var MDCChipFoundation = /** @class */ (function (_super) {
	    __extends(MDCChipFoundation, _super);
	    function MDCChipFoundation(adapter) {
	        var _this = _super.call(this, __assign(__assign({}, MDCChipFoundation.defaultAdapter), adapter)) || this;
	        /** Whether a trailing icon click should immediately trigger exit/removal of the chip. */
	        _this.shouldRemoveOnTrailingIconClick = true;
	        /**
	         * Whether the primary action should receive focus on click. Should only be
	         * set to true for clients who programmatically give focus to a different
	         * element on the page when a chip is clicked (like a menu).
	         */
	        _this.shouldFocusPrimaryActionOnClick = true;
	        return _this;
	    }
	    Object.defineProperty(MDCChipFoundation, "strings", {
	        get: function () {
	            return strings$2;
	        },
	        enumerable: false,
	        configurable: true
	    });
	    Object.defineProperty(MDCChipFoundation, "cssClasses", {
	        get: function () {
	            return cssClasses$2;
	        },
	        enumerable: false,
	        configurable: true
	    });
	    Object.defineProperty(MDCChipFoundation, "defaultAdapter", {
	        get: function () {
	            return {
	                addClass: function () { return undefined; },
	                addClassToLeadingIcon: function () { return undefined; },
	                eventTargetHasClass: function () { return false; },
	                focusPrimaryAction: function () { return undefined; },
	                focusTrailingAction: function () { return undefined; },
	                getAttribute: function () { return null; },
	                getCheckmarkBoundingClientRect: function () { return emptyClientRect; },
	                getComputedStyleValue: function () { return ''; },
	                getRootBoundingClientRect: function () { return emptyClientRect; },
	                hasClass: function () { return false; },
	                hasLeadingIcon: function () { return false; },
	                isRTL: function () { return false; },
	                isTrailingActionNavigable: function () { return false; },
	                notifyEditFinish: function () { return undefined; },
	                notifyEditStart: function () { return undefined; },
	                notifyInteraction: function () { return undefined; },
	                notifyNavigation: function () { return undefined; },
	                notifyRemoval: function () { return undefined; },
	                notifySelection: function () { return undefined; },
	                notifyTrailingIconInteraction: function () { return undefined; },
	                removeClass: function () { return undefined; },
	                removeClassFromLeadingIcon: function () { return undefined; },
	                removeTrailingActionFocus: function () { return undefined; },
	                setPrimaryActionAttr: function () { return undefined; },
	                setStyleProperty: function () { return undefined; },
	            };
	        },
	        enumerable: false,
	        configurable: true
	    });
	    MDCChipFoundation.prototype.isSelected = function () {
	        return this.adapter.hasClass(cssClasses$2.SELECTED);
	    };
	    MDCChipFoundation.prototype.isEditable = function () {
	        return this.adapter.hasClass(cssClasses$2.EDITABLE);
	    };
	    MDCChipFoundation.prototype.isEditing = function () {
	        return this.adapter.hasClass(cssClasses$2.EDITING);
	    };
	    MDCChipFoundation.prototype.setSelected = function (selected) {
	        this.setSelectedImpl(selected);
	        this.notifySelection(selected);
	    };
	    MDCChipFoundation.prototype.setSelectedFromChipSet = function (selected, shouldNotifyClients) {
	        this.setSelectedImpl(selected);
	        if (shouldNotifyClients) {
	            this.notifyIgnoredSelection(selected);
	        }
	    };
	    MDCChipFoundation.prototype.getShouldRemoveOnTrailingIconClick = function () {
	        return this.shouldRemoveOnTrailingIconClick;
	    };
	    MDCChipFoundation.prototype.setShouldRemoveOnTrailingIconClick = function (shouldRemove) {
	        this.shouldRemoveOnTrailingIconClick = shouldRemove;
	    };
	    MDCChipFoundation.prototype.setShouldFocusPrimaryActionOnClick = function (shouldFocus) {
	        this.shouldFocusPrimaryActionOnClick = shouldFocus;
	    };
	    MDCChipFoundation.prototype.getDimensions = function () {
	        var _this = this;
	        var getRootRect = function () { return _this.adapter.getRootBoundingClientRect(); };
	        var getCheckmarkRect = function () {
	            return _this.adapter.getCheckmarkBoundingClientRect();
	        };
	        // When a chip has a checkmark and not a leading icon, the bounding rect changes in size depending on the current
	        // size of the checkmark.
	        if (!this.adapter.hasLeadingIcon()) {
	            var checkmarkRect = getCheckmarkRect();
	            if (checkmarkRect) {
	                var rootRect = getRootRect();
	                // Checkmark is a square, meaning the client rect's width and height are identical once the animation completes.
	                // However, the checkbox is initially hidden by setting the width to 0.
	                // To account for an initial width of 0, we use the checkbox's height instead (which equals the end-state width)
	                // when adding it to the root client rect's width.
	                return {
	                    bottom: rootRect.bottom,
	                    height: rootRect.height,
	                    left: rootRect.left,
	                    right: rootRect.right,
	                    top: rootRect.top,
	                    width: rootRect.width + checkmarkRect.height,
	                };
	            }
	        }
	        return getRootRect();
	    };
	    /**
	     * Begins the exit animation which leads to removal of the chip.
	     */
	    MDCChipFoundation.prototype.beginExit = function () {
	        this.adapter.addClass(cssClasses$2.CHIP_EXIT);
	    };
	    MDCChipFoundation.prototype.handleClick = function () {
	        this.adapter.notifyInteraction();
	        this.setPrimaryActionFocusable(this.getFocusBehavior());
	    };
	    MDCChipFoundation.prototype.handleDoubleClick = function () {
	        if (this.isEditable()) {
	            this.startEditing();
	        }
	    };
	    /**
	     * Handles a transition end event on the root element.
	     */
	    MDCChipFoundation.prototype.handleTransitionEnd = function (evt) {
	        var _this = this;
	        // Handle transition end event on the chip when it is about to be removed.
	        var shouldHandle = this.adapter.eventTargetHasClass(evt.target, cssClasses$2.CHIP_EXIT);
	        var widthIsAnimating = evt.propertyName === 'width';
	        var opacityIsAnimating = evt.propertyName === 'opacity';
	        if (shouldHandle && opacityIsAnimating) {
	            // See: https://css-tricks.com/using-css-transitions-auto-dimensions/#article-header-id-5
	            var chipWidth_1 = this.adapter.getComputedStyleValue('width');
	            // On the next frame (once we get the computed width), explicitly set the chip's width
	            // to its current pixel width, so we aren't transitioning out of 'auto'.
	            requestAnimationFrame(function () {
	                _this.adapter.setStyleProperty('width', chipWidth_1);
	                // To mitigate jitter, start transitioning padding and margin before width.
	                _this.adapter.setStyleProperty('padding', '0');
	                _this.adapter.setStyleProperty('margin', '0');
	                // On the next frame (once width is explicitly set), transition width to 0.
	                requestAnimationFrame(function () {
	                    _this.adapter.setStyleProperty('width', '0');
	                });
	            });
	            return;
	        }
	        if (shouldHandle && widthIsAnimating) {
	            this.removeFocus();
	            var removedAnnouncement = this.adapter.getAttribute(strings$2.REMOVED_ANNOUNCEMENT_ATTRIBUTE);
	            this.adapter.notifyRemoval(removedAnnouncement);
	        }
	        // Handle a transition end event on the leading icon or checkmark, since the transition end event bubbles.
	        if (!opacityIsAnimating) {
	            return;
	        }
	        var shouldHideLeadingIcon = this.adapter.eventTargetHasClass(evt.target, cssClasses$2.LEADING_ICON) &&
	            this.adapter.hasClass(cssClasses$2.SELECTED);
	        var shouldShowLeadingIcon = this.adapter.eventTargetHasClass(evt.target, cssClasses$2.CHECKMARK) &&
	            !this.adapter.hasClass(cssClasses$2.SELECTED);
	        if (shouldHideLeadingIcon) {
	            this.adapter.addClassToLeadingIcon(cssClasses$2.HIDDEN_LEADING_ICON);
	            return;
	        }
	        if (shouldShowLeadingIcon) {
	            this.adapter.removeClassFromLeadingIcon(cssClasses$2.HIDDEN_LEADING_ICON);
	            return;
	        }
	    };
	    MDCChipFoundation.prototype.handleFocusIn = function (evt) {
	        // Early exit if the event doesn't come from the primary action
	        if (!this.eventFromPrimaryAction(evt)) {
	            return;
	        }
	        this.adapter.addClass(cssClasses$2.PRIMARY_ACTION_FOCUSED);
	    };
	    MDCChipFoundation.prototype.handleFocusOut = function (evt) {
	        // Early exit if the event doesn't come from the primary action
	        if (!this.eventFromPrimaryAction(evt)) {
	            return;
	        }
	        if (this.isEditing()) {
	            this.finishEditing();
	        }
	        this.adapter.removeClass(cssClasses$2.PRIMARY_ACTION_FOCUSED);
	    };
	    /**
	     * Handles an interaction event on the trailing icon element. This is used to
	     * prevent the ripple from activating on interaction with the trailing icon.
	     */
	    MDCChipFoundation.prototype.handleTrailingActionInteraction = function () {
	        this.adapter.notifyTrailingIconInteraction();
	        this.removeChip();
	    };
	    /**
	     * Handles a keydown event from the root element.
	     */
	    MDCChipFoundation.prototype.handleKeydown = function (evt) {
	        if (this.isEditing()) {
	            if (this.shouldFinishEditing(evt)) {
	                evt.preventDefault();
	                this.finishEditing();
	            }
	            // When editing, the foundation should only handle key events that finish
	            // the editing process.
	            return;
	        }
	        if (this.isEditable()) {
	            if (this.shouldStartEditing(evt)) {
	                evt.preventDefault();
	                this.startEditing();
	            }
	        }
	        if (this.shouldNotifyInteraction(evt)) {
	            this.adapter.notifyInteraction();
	            this.setPrimaryActionFocusable(this.getFocusBehavior());
	            return;
	        }
	        if (this.isDeleteAction(evt)) {
	            evt.preventDefault();
	            this.removeChip();
	            return;
	        }
	        // Early exit if the key is not usable
	        if (!navigationKeys.has(evt.key)) {
	            return;
	        }
	        // Prevent default behavior for movement keys which could include scrolling
	        evt.preventDefault();
	        this.focusNextAction(evt.key, EventSource.PRIMARY);
	    };
	    MDCChipFoundation.prototype.handleTrailingActionNavigation = function (evt) {
	        this.focusNextAction(evt.detail.key, EventSource.TRAILING);
	    };
	    /**
	     * Called by the chip set to remove focus from the chip actions.
	     */
	    MDCChipFoundation.prototype.removeFocus = function () {
	        this.adapter.setPrimaryActionAttr(strings$2.TAB_INDEX, '-1');
	        this.adapter.removeTrailingActionFocus();
	    };
	    /**
	     * Called by the chip set to focus the primary action.
	     *
	     */
	    MDCChipFoundation.prototype.focusPrimaryAction = function () {
	        this.setPrimaryActionFocusable(FocusBehavior.SHOULD_FOCUS);
	    };
	    /**
	     * Called by the chip set to focus the trailing action (if present), otherwise
	     * gives focus to the trailing action.
	     */
	    MDCChipFoundation.prototype.focusTrailingAction = function () {
	        var trailingActionIsNavigable = this.adapter.isTrailingActionNavigable();
	        if (trailingActionIsNavigable) {
	            this.adapter.setPrimaryActionAttr(strings$2.TAB_INDEX, '-1');
	            this.adapter.focusTrailingAction();
	            return;
	        }
	        this.focusPrimaryAction();
	    };
	    MDCChipFoundation.prototype.setPrimaryActionFocusable = function (focusBehavior) {
	        this.adapter.setPrimaryActionAttr(strings$2.TAB_INDEX, '0');
	        if (focusBehavior === FocusBehavior.SHOULD_FOCUS) {
	            this.adapter.focusPrimaryAction();
	        }
	        this.adapter.removeTrailingActionFocus();
	    };
	    MDCChipFoundation.prototype.getFocusBehavior = function () {
	        if (this.shouldFocusPrimaryActionOnClick) {
	            return FocusBehavior.SHOULD_FOCUS;
	        }
	        return FocusBehavior.SHOULD_NOT_FOCUS;
	    };
	    MDCChipFoundation.prototype.focusNextAction = function (key, source) {
	        var isTrailingActionNavigable = this.adapter.isTrailingActionNavigable();
	        var dir = this.getDirection(key);
	        // Early exit if the key should jump chips
	        if (jumpChipKeys.has(key) || !isTrailingActionNavigable) {
	            this.adapter.notifyNavigation(key, source);
	            return;
	        }
	        if (source === EventSource.PRIMARY && dir === Direction.RIGHT) {
	            this.focusTrailingAction();
	            return;
	        }
	        if (source === EventSource.TRAILING && dir === Direction.LEFT) {
	            this.focusPrimaryAction();
	            return;
	        }
	        this.adapter.notifyNavigation(key, EventSource.NONE);
	    };
	    MDCChipFoundation.prototype.getDirection = function (key) {
	        var isRTL = this.adapter.isRTL();
	        var isLeftKey = key === strings$2.ARROW_LEFT_KEY || key === strings$2.IE_ARROW_LEFT_KEY;
	        var isRightKey = key === strings$2.ARROW_RIGHT_KEY || key === strings$2.IE_ARROW_RIGHT_KEY;
	        if (!isRTL && isLeftKey || isRTL && isRightKey) {
	            return Direction.LEFT;
	        }
	        return Direction.RIGHT;
	    };
	    MDCChipFoundation.prototype.removeChip = function () {
	        if (this.shouldRemoveOnTrailingIconClick) {
	            this.beginExit();
	        }
	    };
	    MDCChipFoundation.prototype.shouldStartEditing = function (evt) {
	        return this.eventFromPrimaryAction(evt) && evt.key === strings$2.ENTER_KEY;
	    };
	    MDCChipFoundation.prototype.shouldFinishEditing = function (evt) {
	        return evt.key === strings$2.ENTER_KEY;
	    };
	    MDCChipFoundation.prototype.shouldNotifyInteraction = function (evt) {
	        return evt.key === strings$2.ENTER_KEY || evt.key === strings$2.SPACEBAR_KEY;
	    };
	    MDCChipFoundation.prototype.isDeleteAction = function (evt) {
	        var isDeletable = this.adapter.hasClass(cssClasses$2.DELETABLE);
	        return isDeletable &&
	            (evt.key === strings$2.BACKSPACE_KEY || evt.key === strings$2.DELETE_KEY ||
	                evt.key === strings$2.IE_DELETE_KEY);
	    };
	    MDCChipFoundation.prototype.setSelectedImpl = function (selected) {
	        if (selected) {
	            this.adapter.addClass(cssClasses$2.SELECTED);
	            this.adapter.setPrimaryActionAttr(strings$2.ARIA_CHECKED, 'true');
	        }
	        else {
	            this.adapter.removeClass(cssClasses$2.SELECTED);
	            this.adapter.setPrimaryActionAttr(strings$2.ARIA_CHECKED, 'false');
	        }
	    };
	    MDCChipFoundation.prototype.notifySelection = function (selected) {
	        this.adapter.notifySelection(selected, false);
	    };
	    MDCChipFoundation.prototype.notifyIgnoredSelection = function (selected) {
	        this.adapter.notifySelection(selected, true);
	    };
	    MDCChipFoundation.prototype.eventFromPrimaryAction = function (evt) {
	        return this.adapter.eventTargetHasClass(evt.target, cssClasses$2.PRIMARY_ACTION);
	    };
	    MDCChipFoundation.prototype.startEditing = function () {
	        this.adapter.addClass(cssClasses$2.EDITING);
	        this.adapter.notifyEditStart();
	    };
	    MDCChipFoundation.prototype.finishEditing = function () {
	        this.adapter.removeClass(cssClasses$2.EDITING);
	        this.adapter.notifyEditFinish();
	    };
	    return MDCChipFoundation;
	}(MDCFoundation));

	/**
	 * @license
	 * Copyright 2016 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */
	var MDCChip = /** @class */ (function (_super) {
	    __extends(MDCChip, _super);
	    function MDCChip() {
	        return _super !== null && _super.apply(this, arguments) || this;
	    }
	    Object.defineProperty(MDCChip.prototype, "selected", {
	        /**
	         * @return Whether the chip is selected.
	         */
	        get: function () {
	            return this.foundation.isSelected();
	        },
	        /**
	         * Sets selected state on the chip.
	         */
	        set: function (selected) {
	            this.foundation.setSelected(selected);
	        },
	        enumerable: false,
	        configurable: true
	    });
	    Object.defineProperty(MDCChip.prototype, "shouldRemoveOnTrailingIconClick", {
	        /**
	         * @return Whether a trailing icon click should trigger exit/removal of the chip.
	         */
	        get: function () {
	            return this.foundation.getShouldRemoveOnTrailingIconClick();
	        },
	        /**
	         * Sets whether a trailing icon click should trigger exit/removal of the chip.
	         */
	        set: function (shouldRemove) {
	            this.foundation.setShouldRemoveOnTrailingIconClick(shouldRemove);
	        },
	        enumerable: false,
	        configurable: true
	    });
	    Object.defineProperty(MDCChip.prototype, "setShouldFocusPrimaryActionOnClick", {
	        /**
	         * Sets whether a clicking on the chip should focus the primary action.
	         */
	        set: function (shouldFocus) {
	            this.foundation.setShouldFocusPrimaryActionOnClick(shouldFocus);
	        },
	        enumerable: false,
	        configurable: true
	    });
	    Object.defineProperty(MDCChip.prototype, "ripple", {
	        get: function () {
	            return this.rippleSurface;
	        },
	        enumerable: false,
	        configurable: true
	    });
	    Object.defineProperty(MDCChip.prototype, "id", {
	        get: function () {
	            return this.root.id;
	        },
	        enumerable: false,
	        configurable: true
	    });
	    MDCChip.attachTo = function (root) {
	        return new MDCChip(root);
	    };
	    MDCChip.prototype.initialize = function (rippleFactory, trailingActionFactory) {
	        var _this = this;
	        if (rippleFactory === void 0) { rippleFactory = function (el, foundation) { return new MDCRipple(el, foundation); }; }
	        if (trailingActionFactory === void 0) { trailingActionFactory = function (el) { return new MDCChipTrailingAction(el); }; }
	        this.leadingIcon = this.root.querySelector(strings$2.LEADING_ICON_SELECTOR);
	        this.checkmark = this.root.querySelector(strings$2.CHECKMARK_SELECTOR);
	        this.primaryAction =
	            this.root.querySelector(strings$2.PRIMARY_ACTION_SELECTOR);
	        var trailingActionEl = this.root.querySelector(strings$2.TRAILING_ACTION_SELECTOR);
	        if (trailingActionEl) {
	            this.trailingAction = trailingActionFactory(trailingActionEl);
	        }
	        // DO NOT INLINE this variable. For backward compatibility, foundations take a Partial<MDCFooAdapter>.
	        // To ensure we don't accidentally omit any methods, we need a separate, strongly typed adapter variable.
	        var rippleAdapter = __assign(__assign({}, MDCRipple.createAdapter(this)), { computeBoundingRect: function () { return _this.foundation.getDimensions(); } });
	        this.rippleSurface =
	            rippleFactory(this.root, new MDCRippleFoundation(rippleAdapter));
	    };
	    MDCChip.prototype.initialSyncWithDOM = function () {
	        var _this = this;
	        // Custom events
	        this.handleTrailingActionInteraction = function () {
	            _this.foundation.handleTrailingActionInteraction();
	        };
	        this.handleTrailingActionNavigation =
	            function (evt) {
	                _this.foundation.handleTrailingActionNavigation(evt);
	            };
	        // Native events
	        this.handleClick = function () {
	            _this.foundation.handleClick();
	        };
	        this.handleKeydown = function (evt) {
	            _this.foundation.handleKeydown(evt);
	        };
	        this.handleTransitionEnd = function (evt) {
	            _this.foundation.handleTransitionEnd(evt);
	        };
	        this.handleFocusIn = function (evt) {
	            _this.foundation.handleFocusIn(evt);
	        };
	        this.handleFocusOut = function (evt) {
	            _this.foundation.handleFocusOut(evt);
	        };
	        this.listen('transitionend', this.handleTransitionEnd);
	        this.listen('click', this.handleClick);
	        this.listen('keydown', this.handleKeydown);
	        this.listen('focusin', this.handleFocusIn);
	        this.listen('focusout', this.handleFocusOut);
	        if (this.trailingAction) {
	            this.listen(strings$3.INTERACTION_EVENT, this.handleTrailingActionInteraction);
	            this.listen(strings$3.NAVIGATION_EVENT, this.handleTrailingActionNavigation);
	        }
	    };
	    MDCChip.prototype.destroy = function () {
	        this.rippleSurface.destroy();
	        this.unlisten('transitionend', this.handleTransitionEnd);
	        this.unlisten('keydown', this.handleKeydown);
	        this.unlisten('click', this.handleClick);
	        this.unlisten('focusin', this.handleFocusIn);
	        this.unlisten('focusout', this.handleFocusOut);
	        if (this.trailingAction) {
	            this.unlisten(strings$3.INTERACTION_EVENT, this.handleTrailingActionInteraction);
	            this.unlisten(strings$3.NAVIGATION_EVENT, this.handleTrailingActionNavigation);
	        }
	        _super.prototype.destroy.call(this);
	    };
	    /**
	     * Begins the exit animation which leads to removal of the chip.
	     */
	    MDCChip.prototype.beginExit = function () {
	        this.foundation.beginExit();
	    };
	    MDCChip.prototype.getDefaultFoundation = function () {
	        var _this = this;
	        // DO NOT INLINE this variable. For backward compatibility, foundations take a Partial<MDCFooAdapter>.
	        // To ensure we don't accidentally omit any methods, we need a separate, strongly typed adapter variable.
	        var adapter = {
	            addClass: function (className) { return _this.root.classList.add(className); },
	            addClassToLeadingIcon: function (className) {
	                if (_this.leadingIcon) {
	                    _this.leadingIcon.classList.add(className);
	                }
	            },
	            eventTargetHasClass: function (target, className) {
	                return target ? target.classList.contains(className) : false;
	            },
	            focusPrimaryAction: function () {
	                if (_this.primaryAction) {
	                    _this.primaryAction.focus();
	                }
	            },
	            focusTrailingAction: function () {
	                if (_this.trailingAction) {
	                    _this.trailingAction.focus();
	                }
	            },
	            getAttribute: function (attr) { return _this.root.getAttribute(attr); },
	            getCheckmarkBoundingClientRect: function () {
	                return _this.checkmark ? _this.checkmark.getBoundingClientRect() : null;
	            },
	            getComputedStyleValue: function (propertyName) {
	                return window.getComputedStyle(_this.root).getPropertyValue(propertyName);
	            },
	            getRootBoundingClientRect: function () { return _this.root.getBoundingClientRect(); },
	            hasClass: function (className) { return _this.root.classList.contains(className); },
	            hasLeadingIcon: function () { return !!_this.leadingIcon; },
	            isRTL: function () { return window.getComputedStyle(_this.root).getPropertyValue('direction') === 'rtl'; },
	            isTrailingActionNavigable: function () {
	                if (_this.trailingAction) {
	                    return _this.trailingAction.isNavigable();
	                }
	                return false;
	            },
	            notifyInteraction: function () { return _this.emit(strings$2.INTERACTION_EVENT, { chipId: _this.id }, true /* shouldBubble */); },
	            notifyNavigation: function (key, source) {
	                return _this.emit(strings$2.NAVIGATION_EVENT, { chipId: _this.id, key: key, source: source }, true /* shouldBubble */);
	            },
	            notifyRemoval: function (removedAnnouncement) {
	                _this.emit(strings$2.REMOVAL_EVENT, { chipId: _this.id, removedAnnouncement: removedAnnouncement }, true /* shouldBubble */);
	            },
	            notifySelection: function (selected, shouldIgnore) {
	                return _this.emit(strings$2.SELECTION_EVENT, { chipId: _this.id, selected: selected, shouldIgnore: shouldIgnore }, true /* shouldBubble */);
	            },
	            notifyTrailingIconInteraction: function () {
	                return _this.emit(strings$2.TRAILING_ICON_INTERACTION_EVENT, { chipId: _this.id }, true /* shouldBubble */);
	            },
	            notifyEditStart: function () { },
	            notifyEditFinish: function () { },
	            removeClass: function (className) { return _this.root.classList.remove(className); },
	            removeClassFromLeadingIcon: function (className) {
	                if (_this.leadingIcon) {
	                    _this.leadingIcon.classList.remove(className);
	                }
	            },
	            removeTrailingActionFocus: function () {
	                if (_this.trailingAction) {
	                    _this.trailingAction.removeFocus();
	                }
	            },
	            setPrimaryActionAttr: function (attr, value) {
	                if (_this.primaryAction) {
	                    _this.primaryAction.setAttribute(attr, value);
	                }
	            },
	            setStyleProperty: function (propertyName, value) {
	                return _this.root.style.setProperty(propertyName, value);
	            },
	        };
	        return new MDCChipFoundation(adapter);
	    };
	    MDCChip.prototype.setSelectedFromChipSet = function (selected, shouldNotifyClients) {
	        this.foundation.setSelectedFromChipSet(selected, shouldNotifyClients);
	    };
	    MDCChip.prototype.focusPrimaryAction = function () {
	        this.foundation.focusPrimaryAction();
	    };
	    MDCChip.prototype.focusTrailingAction = function () {
	        this.foundation.focusTrailingAction();
	    };
	    MDCChip.prototype.removeFocus = function () {
	        this.foundation.removeFocus();
	    };
	    MDCChip.prototype.remove = function () {
	        var parent = this.root.parentNode;
	        if (parent !== null) {
	            parent.removeChild(this.root);
	        }
	    };
	    return MDCChip;
	}(MDCComponent));

	/**
	 * @license
	 * Copyright 2016 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */
	var strings$1 = {
	    CHIP_SELECTOR: '.mdc-chip',
	};
	var cssClasses$1 = {
	    CHOICE: 'mdc-chip-set--choice',
	    FILTER: 'mdc-chip-set--filter',
	};

	/**
	 * @license
	 * Copyright 2017 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */
	var MDCChipSetFoundation = /** @class */ (function (_super) {
	    __extends(MDCChipSetFoundation, _super);
	    function MDCChipSetFoundation(adapter) {
	        var _this = _super.call(this, __assign(__assign({}, MDCChipSetFoundation.defaultAdapter), adapter)) || this;
	        /**
	         * The ids of the selected chips in the set. Only used for choice chip set or filter chip set.
	         */
	        _this.selectedChipIds = [];
	        return _this;
	    }
	    Object.defineProperty(MDCChipSetFoundation, "strings", {
	        get: function () {
	            return strings$1;
	        },
	        enumerable: false,
	        configurable: true
	    });
	    Object.defineProperty(MDCChipSetFoundation, "cssClasses", {
	        get: function () {
	            return cssClasses$1;
	        },
	        enumerable: false,
	        configurable: true
	    });
	    Object.defineProperty(MDCChipSetFoundation, "defaultAdapter", {
	        get: function () {
	            return {
	                announceMessage: function () { return undefined; },
	                focusChipPrimaryActionAtIndex: function () { return undefined; },
	                focusChipTrailingActionAtIndex: function () { return undefined; },
	                getChipListCount: function () { return -1; },
	                getIndexOfChipById: function () { return -1; },
	                hasClass: function () { return false; },
	                isRTL: function () { return false; },
	                removeChipAtIndex: function () { return undefined; },
	                removeFocusFromChipAtIndex: function () { return undefined; },
	                selectChipAtIndex: function () { return undefined; },
	            };
	        },
	        enumerable: false,
	        configurable: true
	    });
	    /**
	     * Returns an array of the IDs of all selected chips.
	     */
	    MDCChipSetFoundation.prototype.getSelectedChipIds = function () {
	        return this.selectedChipIds.slice();
	    };
	    /**
	     * Selects the chip with the given id. Deselects all other chips if the chip set is of the choice variant.
	     * Does not notify clients of the updated selection state.
	     */
	    MDCChipSetFoundation.prototype.select = function (chipId) {
	        this.selectImpl(chipId, false);
	    };
	    /**
	     * Handles a chip interaction event
	     */
	    MDCChipSetFoundation.prototype.handleChipInteraction = function (_a) {
	        var chipId = _a.chipId;
	        var index = this.adapter.getIndexOfChipById(chipId);
	        this.removeFocusFromChipsExcept(index);
	        if (this.adapter.hasClass(cssClasses$1.CHOICE) ||
	            this.adapter.hasClass(cssClasses$1.FILTER)) {
	            this.toggleSelect(chipId);
	        }
	    };
	    /**
	     * Handles a chip selection event, used to handle discrepancy when selection state is set directly on the Chip.
	     */
	    MDCChipSetFoundation.prototype.handleChipSelection = function (_a) {
	        var chipId = _a.chipId, selected = _a.selected, shouldIgnore = _a.shouldIgnore;
	        // Early exit if we should ignore the event
	        if (shouldIgnore) {
	            return;
	        }
	        var chipIsSelected = this.selectedChipIds.indexOf(chipId) >= 0;
	        if (selected && !chipIsSelected) {
	            this.select(chipId);
	        }
	        else if (!selected && chipIsSelected) {
	            this.deselectImpl(chipId);
	        }
	    };
	    /**
	     * Handles the event when a chip is removed.
	     */
	    MDCChipSetFoundation.prototype.handleChipRemoval = function (_a) {
	        var chipId = _a.chipId, removedAnnouncement = _a.removedAnnouncement;
	        if (removedAnnouncement) {
	            this.adapter.announceMessage(removedAnnouncement);
	        }
	        var index = this.adapter.getIndexOfChipById(chipId);
	        this.deselectAndNotifyClients(chipId);
	        this.adapter.removeChipAtIndex(index);
	        var maxIndex = this.adapter.getChipListCount() - 1;
	        if (maxIndex < 0) {
	            return;
	        }
	        var nextIndex = Math.min(index, maxIndex);
	        this.removeFocusFromChipsExcept(nextIndex);
	        // After removing a chip, we should focus the trailing action for the next chip.
	        this.adapter.focusChipTrailingActionAtIndex(nextIndex);
	    };
	    /**
	     * Handles a chip navigation event.
	     */
	    MDCChipSetFoundation.prototype.handleChipNavigation = function (_a) {
	        var chipId = _a.chipId, key = _a.key, source = _a.source;
	        var maxIndex = this.adapter.getChipListCount() - 1;
	        var index = this.adapter.getIndexOfChipById(chipId);
	        // Early exit if the index is out of range or the key is unusable
	        if (index === -1 || !navigationKeys.has(key)) {
	            return;
	        }
	        var isRTL = this.adapter.isRTL();
	        var isLeftKey = key === strings$2.ARROW_LEFT_KEY ||
	            key === strings$2.IE_ARROW_LEFT_KEY;
	        var isRightKey = key === strings$2.ARROW_RIGHT_KEY ||
	            key === strings$2.IE_ARROW_RIGHT_KEY;
	        var isDownKey = key === strings$2.ARROW_DOWN_KEY ||
	            key === strings$2.IE_ARROW_DOWN_KEY;
	        var shouldIncrement = !isRTL && isRightKey || isRTL && isLeftKey || isDownKey;
	        var isHome = key === strings$2.HOME_KEY;
	        var isEnd = key === strings$2.END_KEY;
	        if (shouldIncrement) {
	            index++;
	        }
	        else if (isHome) {
	            index = 0;
	        }
	        else if (isEnd) {
	            index = maxIndex;
	        }
	        else {
	            index--;
	        }
	        // Early exit if the index is out of bounds
	        if (index < 0 || index > maxIndex) {
	            return;
	        }
	        this.removeFocusFromChipsExcept(index);
	        this.focusChipAction(index, key, source);
	    };
	    MDCChipSetFoundation.prototype.focusChipAction = function (index, key, source) {
	        var shouldJumpChips = jumpChipKeys.has(key);
	        if (shouldJumpChips && source === EventSource.PRIMARY) {
	            return this.adapter.focusChipPrimaryActionAtIndex(index);
	        }
	        if (shouldJumpChips && source === EventSource.TRAILING) {
	            return this.adapter.focusChipTrailingActionAtIndex(index);
	        }
	        var dir = this.getDirection(key);
	        if (dir === Direction.LEFT) {
	            return this.adapter.focusChipTrailingActionAtIndex(index);
	        }
	        if (dir === Direction.RIGHT) {
	            return this.adapter.focusChipPrimaryActionAtIndex(index);
	        }
	    };
	    MDCChipSetFoundation.prototype.getDirection = function (key) {
	        var isRTL = this.adapter.isRTL();
	        var isLeftKey = key === strings$2.ARROW_LEFT_KEY ||
	            key === strings$2.IE_ARROW_LEFT_KEY;
	        var isRightKey = key === strings$2.ARROW_RIGHT_KEY ||
	            key === strings$2.IE_ARROW_RIGHT_KEY;
	        if (!isRTL && isLeftKey || isRTL && isRightKey) {
	            return Direction.LEFT;
	        }
	        return Direction.RIGHT;
	    };
	    /**
	     * Deselects the chip with the given id and optionally notifies clients.
	     */
	    MDCChipSetFoundation.prototype.deselectImpl = function (chipId, shouldNotifyClients) {
	        if (shouldNotifyClients === void 0) { shouldNotifyClients = false; }
	        var index = this.selectedChipIds.indexOf(chipId);
	        if (index >= 0) {
	            this.selectedChipIds.splice(index, 1);
	            var chipIndex = this.adapter.getIndexOfChipById(chipId);
	            this.adapter.selectChipAtIndex(chipIndex, /** isSelected */ false, shouldNotifyClients);
	        }
	    };
	    /**
	     * Deselects the chip with the given id and notifies clients.
	     */
	    MDCChipSetFoundation.prototype.deselectAndNotifyClients = function (chipId) {
	        this.deselectImpl(chipId, true);
	    };
	    /**
	     * Toggles selection of the chip with the given id.
	     */
	    MDCChipSetFoundation.prototype.toggleSelect = function (chipId) {
	        if (this.selectedChipIds.indexOf(chipId) >= 0) {
	            this.deselectAndNotifyClients(chipId);
	        }
	        else {
	            this.selectAndNotifyClients(chipId);
	        }
	    };
	    MDCChipSetFoundation.prototype.removeFocusFromChipsExcept = function (index) {
	        var chipCount = this.adapter.getChipListCount();
	        for (var i = 0; i < chipCount; i++) {
	            if (i !== index) {
	                this.adapter.removeFocusFromChipAtIndex(i);
	            }
	        }
	    };
	    MDCChipSetFoundation.prototype.selectAndNotifyClients = function (chipId) {
	        this.selectImpl(chipId, true);
	    };
	    MDCChipSetFoundation.prototype.selectImpl = function (chipId, shouldNotifyClients) {
	        if (this.selectedChipIds.indexOf(chipId) >= 0) {
	            return;
	        }
	        if (this.adapter.hasClass(cssClasses$1.CHOICE) &&
	            this.selectedChipIds.length > 0) {
	            var previouslySelectedChip = this.selectedChipIds[0];
	            var previouslySelectedIndex = this.adapter.getIndexOfChipById(previouslySelectedChip);
	            this.selectedChipIds = [];
	            this.adapter.selectChipAtIndex(previouslySelectedIndex, /** isSelected */ false, shouldNotifyClients);
	        }
	        this.selectedChipIds.push(chipId);
	        var index = this.adapter.getIndexOfChipById(chipId);
	        this.adapter.selectChipAtIndex(index, /** isSelected */ true, shouldNotifyClients);
	    };
	    return MDCChipSetFoundation;
	}(MDCFoundation));

	/**
	 * @license
	 * Copyright 2016 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */
	var _a = MDCChipFoundation.strings, INTERACTION_EVENT = _a.INTERACTION_EVENT, SELECTION_EVENT = _a.SELECTION_EVENT, REMOVAL_EVENT = _a.REMOVAL_EVENT, NAVIGATION_EVENT = _a.NAVIGATION_EVENT;
	var CHIP_SELECTOR = MDCChipSetFoundation.strings.CHIP_SELECTOR;
	var idCounter = 0;
	var MDCChipSet = /** @class */ (function (_super) {
	    __extends(MDCChipSet, _super);
	    function MDCChipSet() {
	        return _super !== null && _super.apply(this, arguments) || this;
	    }
	    MDCChipSet.attachTo = function (root) {
	        return new MDCChipSet(root);
	    };
	    Object.defineProperty(MDCChipSet.prototype, "chips", {
	        get: function () {
	            return this.chipsList.slice();
	        },
	        enumerable: false,
	        configurable: true
	    });
	    Object.defineProperty(MDCChipSet.prototype, "selectedChipIds", {
	        /**
	         * @return An array of the IDs of all selected chips.
	         */
	        get: function () {
	            return this.foundation.getSelectedChipIds();
	        },
	        enumerable: false,
	        configurable: true
	    });
	    /**
	     * @param chipFactory A function which creates a new MDCChip.
	     */
	    MDCChipSet.prototype.initialize = function (chipFactory) {
	        if (chipFactory === void 0) { chipFactory = function (el) { return new MDCChip(el); }; }
	        this.chipFactory = chipFactory;
	        this.chipsList = this.instantiateChips(this.chipFactory);
	    };
	    MDCChipSet.prototype.initialSyncWithDOM = function () {
	        var e_1, _a;
	        var _this = this;
	        try {
	            for (var _b = __values(this.chipsList), _c = _b.next(); !_c.done; _c = _b.next()) {
	                var chip = _c.value;
	                if (chip.id && chip.selected) {
	                    this.foundation.select(chip.id);
	                }
	            }
	        }
	        catch (e_1_1) { e_1 = { error: e_1_1 }; }
	        finally {
	            try {
	                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
	            }
	            finally { if (e_1) throw e_1.error; }
	        }
	        this.handleChipInteraction = function (evt) {
	            return _this.foundation.handleChipInteraction(evt.detail);
	        };
	        this.handleChipSelection = function (evt) {
	            return _this.foundation.handleChipSelection(evt.detail);
	        };
	        this.handleChipRemoval = function (evt) {
	            return _this.foundation.handleChipRemoval(evt.detail);
	        };
	        this.handleChipNavigation = function (evt) {
	            return _this.foundation.handleChipNavigation(evt.detail);
	        };
	        this.listen(INTERACTION_EVENT, this.handleChipInteraction);
	        this.listen(SELECTION_EVENT, this.handleChipSelection);
	        this.listen(REMOVAL_EVENT, this.handleChipRemoval);
	        this.listen(NAVIGATION_EVENT, this.handleChipNavigation);
	    };
	    MDCChipSet.prototype.destroy = function () {
	        var e_2, _a;
	        try {
	            for (var _b = __values(this.chipsList), _c = _b.next(); !_c.done; _c = _b.next()) {
	                var chip = _c.value;
	                chip.destroy();
	            }
	        }
	        catch (e_2_1) { e_2 = { error: e_2_1 }; }
	        finally {
	            try {
	                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
	            }
	            finally { if (e_2) throw e_2.error; }
	        }
	        this.unlisten(INTERACTION_EVENT, this.handleChipInteraction);
	        this.unlisten(SELECTION_EVENT, this.handleChipSelection);
	        this.unlisten(REMOVAL_EVENT, this.handleChipRemoval);
	        this.unlisten(NAVIGATION_EVENT, this.handleChipNavigation);
	        _super.prototype.destroy.call(this);
	    };
	    /**
	     * Adds a new chip object to the chip set from the given chip element.
	     */
	    MDCChipSet.prototype.addChip = function (chipEl) {
	        chipEl.id = chipEl.id || "mdc-chip-" + ++idCounter;
	        this.chipsList.push(this.chipFactory(chipEl));
	    };
	    MDCChipSet.prototype.getDefaultFoundation = function () {
	        var _this = this;
	        // DO NOT INLINE this variable. For backward compatibility, foundations take a Partial<MDCFooAdapter>.
	        // To ensure we don't accidentally omit any methods, we need a separate, strongly typed adapter variable.
	        var adapter = {
	            announceMessage: function (message) {
	                announce(message);
	            },
	            focusChipPrimaryActionAtIndex: function (index) {
	                _this.chipsList[index].focusPrimaryAction();
	            },
	            focusChipTrailingActionAtIndex: function (index) {
	                _this.chipsList[index].focusTrailingAction();
	            },
	            getChipListCount: function () { return _this.chips.length; },
	            getIndexOfChipById: function (chipId) {
	                return _this.findChipIndex(chipId);
	            },
	            hasClass: function (className) { return _this.root.classList.contains(className); },
	            isRTL: function () { return window.getComputedStyle(_this.root).getPropertyValue('direction') === 'rtl'; },
	            removeChipAtIndex: function (index) {
	                if (index >= 0 && index < _this.chips.length) {
	                    _this.chipsList[index].destroy();
	                    _this.chipsList[index].remove();
	                    _this.chipsList.splice(index, 1);
	                }
	            },
	            removeFocusFromChipAtIndex: function (index) {
	                _this.chipsList[index].removeFocus();
	            },
	            selectChipAtIndex: function (index, selected, shouldNotifyClients) {
	                if (index >= 0 && index < _this.chips.length) {
	                    _this.chipsList[index].setSelectedFromChipSet(selected, shouldNotifyClients);
	                }
	            },
	        };
	        return new MDCChipSetFoundation(adapter);
	    };
	    /**
	     * Instantiates chip components on all of the chip set's child chip elements.
	     */
	    MDCChipSet.prototype.instantiateChips = function (chipFactory) {
	        var chipElements = [].slice.call(this.root.querySelectorAll(CHIP_SELECTOR));
	        return chipElements.map(function (el) {
	            el.id = el.id || "mdc-chip-" + ++idCounter;
	            return chipFactory(el);
	        });
	    };
	    /**
	     * Returns the index of the chip with the given id, or -1 if the chip does not exist.
	     */
	    MDCChipSet.prototype.findChipIndex = function (chipId) {
	        for (var i = 0; i < this.chips.length; i++) {
	            if (this.chipsList[i].id === chipId) {
	                return i;
	            }
	        }
	        return -1;
	    };
	    return MDCChipSet;
	}(MDCComponent));

	/**
	 * @license
	 * Copyright 2019 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */

	var deprecated = /*#__PURE__*/Object.freeze({
		__proto__: null,
		MDCChip: MDCChip,
		MDCChipFoundation: MDCChipFoundation,
		MDCChipSet: MDCChipSet,
		MDCChipSetFoundation: MDCChipSetFoundation,
		MDCChipTrailingAction: MDCChipTrailingAction,
		MDCChipTrailingActionFoundation: MDCChipTrailingActionFoundation,
		chipCssClasses: cssClasses$2,
		chipSetCssClasses: cssClasses$1,
		chipSetStrings: strings$1,
		chipStrings: strings$2,
		trailingActionStrings: strings$3
	});

	/* node_modules/@smui/chips/dist/Chip.svelte generated by Svelte v4.2.7 */

	function create_if_block_1$2(ctx) {
		let div;

		return {
			c() {
				div = element("div");
				attr(div, "class", "mdc-chip__ripple");
			},
			m(target, anchor) {
				insert(target, div, anchor);
			},
			d(detaching) {
				if (detaching) {
					detach(div);
				}
			}
		};
	}

	// (52:2) {#if touch}
	function create_if_block$3(ctx) {
		let div;

		return {
			c() {
				div = element("div");
				attr(div, "class", "mdc-chip__touch");
			},
			m(target, anchor) {
				insert(target, div, anchor);
			},
			d(detaching) {
				if (detaching) {
					detach(div);
				}
			}
		};
	}

	// (1:0) <svelte:component   this={component}   {tag}   bind:this={element}   use={[     [       Ripple,       {         ripple: ripple && !$nonInteractive,         unbounded: false,         addClass,         removeClass,         addStyle,       },     ],     forwardEvents,     ...use,   ]}   class={classMap({     [className]: true,     'mdc-chip': true,     'mdc-chip--selected': selected,     'mdc-chip--touch': touch,     ...internalClasses,   })}   style={Object.entries(internalStyles)     .map(([name, value]) => `${name}: ${value};`)     .concat([style])     .join(' ')}   role="row"   on:transitionend={instance && instance.handleTransitionEnd.bind(instance)}   on:click={instance && instance.handleClick.bind(instance)}   on:keydown={instance && instance.handleKeydown.bind(instance)}   on:focusin={instance && instance.handleFocusIn.bind(instance)}   on:focusout={instance && instance.handleFocusOut.bind(instance)}   on:SMUIChipTrailingAction:interaction={instance &&     instance.handleTrailingActionInteraction.bind(instance)}   on:SMUIChipTrailingAction:navigation={instance &&     instance.handleTrailingActionNavigation.bind(instance)}   on:SMUIChipsChipPrimaryAction:mount={handleSMUIChipsChipPrimaryAction}   on:SMUIChipsChipPrimaryAction:unmount={() =>     (primaryActionAccessor = undefined)}   on:SMUIChipsChipTrailingAction:mount={handleSMUIChipsChipTrailingAction}   on:SMUIChipsChipTrailingAction:unmount={() =>     (trailingActionAccessor = undefined)}   {...$$restProps} >
	function create_default_slot$4(ctx) {
		let t0;
		let t1;
		let if_block1_anchor;
		let current;
		let if_block0 = /*ripple*/ ctx[3] && !/*$nonInteractive*/ ctx[14] && create_if_block_1$2();
		const default_slot_template = /*#slots*/ ctx[34].default;
		const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[38], null);
		let if_block1 = /*touch*/ ctx[4] && create_if_block$3();

		return {
			c() {
				if (if_block0) if_block0.c();
				t0 = space();
				if (default_slot) default_slot.c();
				t1 = space();
				if (if_block1) if_block1.c();
				if_block1_anchor = empty();
			},
			m(target, anchor) {
				if (if_block0) if_block0.m(target, anchor);
				insert(target, t0, anchor);

				if (default_slot) {
					default_slot.m(target, anchor);
				}

				insert(target, t1, anchor);
				if (if_block1) if_block1.m(target, anchor);
				insert(target, if_block1_anchor, anchor);
				current = true;
			},
			p(ctx, dirty) {
				if (/*ripple*/ ctx[3] && !/*$nonInteractive*/ ctx[14]) {
					if (if_block0) ; else {
						if_block0 = create_if_block_1$2();
						if_block0.c();
						if_block0.m(t0.parentNode, t0);
					}
				} else if (if_block0) {
					if_block0.d(1);
					if_block0 = null;
				}

				if (default_slot) {
					if (default_slot.p && (!current || dirty[1] & /*$$scope*/ 128)) {
						update_slot_base(
							default_slot,
							default_slot_template,
							ctx,
							/*$$scope*/ ctx[38],
							!current
							? get_all_dirty_from_scope(/*$$scope*/ ctx[38])
							: get_slot_changes(default_slot_template, /*$$scope*/ ctx[38], dirty, null),
							null
						);
					}
				}

				if (/*touch*/ ctx[4]) {
					if (if_block1) ; else {
						if_block1 = create_if_block$3();
						if_block1.c();
						if_block1.m(if_block1_anchor.parentNode, if_block1_anchor);
					}
				} else if (if_block1) {
					if_block1.d(1);
					if_block1 = null;
				}
			},
			i(local) {
				if (current) return;
				transition_in(default_slot, local);
				current = true;
			},
			o(local) {
				transition_out(default_slot, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(t0);
					detach(t1);
					detach(if_block1_anchor);
				}

				if (if_block0) if_block0.d(detaching);
				if (default_slot) default_slot.d(detaching);
				if (if_block1) if_block1.d(detaching);
			}
		};
	}

	function create_fragment$9(ctx) {
		let switch_instance;
		let switch_instance_anchor;
		let current;

		const switch_instance_spread_levels = [
			{ tag: /*tag*/ ctx[6] },
			{
				use: [
					[
						Ripple,
						{
							ripple: /*ripple*/ ctx[3] && !/*$nonInteractive*/ ctx[14],
							unbounded: false,
							addClass: /*addClass*/ ctx[25],
							removeClass: /*removeClass*/ ctx[26],
							addStyle: /*addStyle*/ ctx[27]
						}
					],
					/*forwardEvents*/ ctx[15],
					.../*use*/ ctx[0]
				]
			},
			{
				class: classMap({
					[/*className*/ ctx[1]]: true,
					'mdc-chip': true,
					'mdc-chip--selected': /*selected*/ ctx[8],
					'mdc-chip--touch': /*touch*/ ctx[4],
					.../*internalClasses*/ ctx[10]
				})
			},
			{
				style: Object.entries(/*internalStyles*/ ctx[11]).map(func$1).concat([/*style*/ ctx[2]]).join(' ')
			},
			{ role: "row" },
			/*$$restProps*/ ctx[28]
		];

		var switch_value = /*component*/ ctx[5];

		function switch_props(ctx, dirty) {
			let switch_instance_props = {
				$$slots: { default: [create_default_slot$4] },
				$$scope: { ctx }
			};

			if (dirty !== undefined && dirty[0] & /*tag, ripple, $nonInteractive, addClass, removeClass, addStyle, forwardEvents, use, className, selected, touch, internalClasses, internalStyles, style, $$restProps*/ 503369055) {
				switch_instance_props = get_spread_update(switch_instance_spread_levels, [
					dirty[0] & /*tag*/ 64 && { tag: /*tag*/ ctx[6] },
					dirty[0] & /*ripple, $nonInteractive, addClass, removeClass, addStyle, forwardEvents, use*/ 234930185 && {
						use: [
							[
								Ripple,
								{
									ripple: /*ripple*/ ctx[3] && !/*$nonInteractive*/ ctx[14],
									unbounded: false,
									addClass: /*addClass*/ ctx[25],
									removeClass: /*removeClass*/ ctx[26],
									addStyle: /*addStyle*/ ctx[27]
								}
							],
							/*forwardEvents*/ ctx[15],
							.../*use*/ ctx[0]
						]
					},
					dirty[0] & /*className, selected, touch, internalClasses*/ 1298 && {
						class: classMap({
							[/*className*/ ctx[1]]: true,
							'mdc-chip': true,
							'mdc-chip--selected': /*selected*/ ctx[8],
							'mdc-chip--touch': /*touch*/ ctx[4],
							.../*internalClasses*/ ctx[10]
						})
					},
					dirty[0] & /*internalStyles, style*/ 2052 && {
						style: Object.entries(/*internalStyles*/ ctx[11]).map(func$1).concat([/*style*/ ctx[2]]).join(' ')
					},
					switch_instance_spread_levels[4],
					dirty[0] & /*$$restProps*/ 268435456 && get_spread_object(/*$$restProps*/ ctx[28])
				]);
			} else {
				for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
					switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
				}
			}

			return { props: switch_instance_props };
		}

		if (switch_value) {
			switch_instance = construct_svelte_component(switch_value, switch_props(ctx));
			/*switch_instance_binding*/ ctx[35](switch_instance);

			switch_instance.$on("transitionend", function () {
				if (is_function(/*instance*/ ctx[7] && /*instance*/ ctx[7].handleTransitionEnd.bind(/*instance*/ ctx[7]))) (/*instance*/ ctx[7] && /*instance*/ ctx[7].handleTransitionEnd.bind(/*instance*/ ctx[7])).apply(this, arguments);
			});

			switch_instance.$on("click", function () {
				if (is_function(/*instance*/ ctx[7] && /*instance*/ ctx[7].handleClick.bind(/*instance*/ ctx[7]))) (/*instance*/ ctx[7] && /*instance*/ ctx[7].handleClick.bind(/*instance*/ ctx[7])).apply(this, arguments);
			});

			switch_instance.$on("keydown", function () {
				if (is_function(/*instance*/ ctx[7] && /*instance*/ ctx[7].handleKeydown.bind(/*instance*/ ctx[7]))) (/*instance*/ ctx[7] && /*instance*/ ctx[7].handleKeydown.bind(/*instance*/ ctx[7])).apply(this, arguments);
			});

			switch_instance.$on("focusin", function () {
				if (is_function(/*instance*/ ctx[7] && /*instance*/ ctx[7].handleFocusIn.bind(/*instance*/ ctx[7]))) (/*instance*/ ctx[7] && /*instance*/ ctx[7].handleFocusIn.bind(/*instance*/ ctx[7])).apply(this, arguments);
			});

			switch_instance.$on("focusout", function () {
				if (is_function(/*instance*/ ctx[7] && /*instance*/ ctx[7].handleFocusOut.bind(/*instance*/ ctx[7]))) (/*instance*/ ctx[7] && /*instance*/ ctx[7].handleFocusOut.bind(/*instance*/ ctx[7])).apply(this, arguments);
			});

			switch_instance.$on("SMUIChipTrailingAction:interaction", function () {
				if (is_function(/*instance*/ ctx[7] && /*instance*/ ctx[7].handleTrailingActionInteraction.bind(/*instance*/ ctx[7]))) (/*instance*/ ctx[7] && /*instance*/ ctx[7].handleTrailingActionInteraction.bind(/*instance*/ ctx[7])).apply(this, arguments);
			});

			switch_instance.$on("SMUIChipTrailingAction:navigation", function () {
				if (is_function(/*instance*/ ctx[7] && /*instance*/ ctx[7].handleTrailingActionNavigation.bind(/*instance*/ ctx[7]))) (/*instance*/ ctx[7] && /*instance*/ ctx[7].handleTrailingActionNavigation.bind(/*instance*/ ctx[7])).apply(this, arguments);
			});

			switch_instance.$on("SMUIChipsChipPrimaryAction:mount", /*handleSMUIChipsChipPrimaryAction*/ ctx[23]);
			switch_instance.$on("SMUIChipsChipPrimaryAction:unmount", /*SMUIChipsChipPrimaryAction_unmount_handler*/ ctx[36]);
			switch_instance.$on("SMUIChipsChipTrailingAction:mount", /*handleSMUIChipsChipTrailingAction*/ ctx[24]);
			switch_instance.$on("SMUIChipsChipTrailingAction:unmount", /*SMUIChipsChipTrailingAction_unmount_handler*/ ctx[37]);
		}

		return {
			c() {
				if (switch_instance) create_component(switch_instance.$$.fragment);
				switch_instance_anchor = empty();
			},
			m(target, anchor) {
				if (switch_instance) mount_component(switch_instance, target, anchor);
				insert(target, switch_instance_anchor, anchor);
				current = true;
			},
			p(new_ctx, dirty) {
				ctx = new_ctx;

				if (dirty[0] & /*component*/ 32 && switch_value !== (switch_value = /*component*/ ctx[5])) {
					if (switch_instance) {
						group_outros();
						const old_component = switch_instance;

						transition_out(old_component.$$.fragment, 1, 0, () => {
							destroy_component(old_component, 1);
						});

						check_outros();
					}

					if (switch_value) {
						switch_instance = construct_svelte_component(switch_value, switch_props(ctx, dirty));
						/*switch_instance_binding*/ ctx[35](switch_instance);

						switch_instance.$on("transitionend", function () {
							if (is_function(/*instance*/ ctx[7] && /*instance*/ ctx[7].handleTransitionEnd.bind(/*instance*/ ctx[7]))) (/*instance*/ ctx[7] && /*instance*/ ctx[7].handleTransitionEnd.bind(/*instance*/ ctx[7])).apply(this, arguments);
						});

						switch_instance.$on("click", function () {
							if (is_function(/*instance*/ ctx[7] && /*instance*/ ctx[7].handleClick.bind(/*instance*/ ctx[7]))) (/*instance*/ ctx[7] && /*instance*/ ctx[7].handleClick.bind(/*instance*/ ctx[7])).apply(this, arguments);
						});

						switch_instance.$on("keydown", function () {
							if (is_function(/*instance*/ ctx[7] && /*instance*/ ctx[7].handleKeydown.bind(/*instance*/ ctx[7]))) (/*instance*/ ctx[7] && /*instance*/ ctx[7].handleKeydown.bind(/*instance*/ ctx[7])).apply(this, arguments);
						});

						switch_instance.$on("focusin", function () {
							if (is_function(/*instance*/ ctx[7] && /*instance*/ ctx[7].handleFocusIn.bind(/*instance*/ ctx[7]))) (/*instance*/ ctx[7] && /*instance*/ ctx[7].handleFocusIn.bind(/*instance*/ ctx[7])).apply(this, arguments);
						});

						switch_instance.$on("focusout", function () {
							if (is_function(/*instance*/ ctx[7] && /*instance*/ ctx[7].handleFocusOut.bind(/*instance*/ ctx[7]))) (/*instance*/ ctx[7] && /*instance*/ ctx[7].handleFocusOut.bind(/*instance*/ ctx[7])).apply(this, arguments);
						});

						switch_instance.$on("SMUIChipTrailingAction:interaction", function () {
							if (is_function(/*instance*/ ctx[7] && /*instance*/ ctx[7].handleTrailingActionInteraction.bind(/*instance*/ ctx[7]))) (/*instance*/ ctx[7] && /*instance*/ ctx[7].handleTrailingActionInteraction.bind(/*instance*/ ctx[7])).apply(this, arguments);
						});

						switch_instance.$on("SMUIChipTrailingAction:navigation", function () {
							if (is_function(/*instance*/ ctx[7] && /*instance*/ ctx[7].handleTrailingActionNavigation.bind(/*instance*/ ctx[7]))) (/*instance*/ ctx[7] && /*instance*/ ctx[7].handleTrailingActionNavigation.bind(/*instance*/ ctx[7])).apply(this, arguments);
						});

						switch_instance.$on("SMUIChipsChipPrimaryAction:mount", /*handleSMUIChipsChipPrimaryAction*/ ctx[23]);
						switch_instance.$on("SMUIChipsChipPrimaryAction:unmount", /*SMUIChipsChipPrimaryAction_unmount_handler*/ ctx[36]);
						switch_instance.$on("SMUIChipsChipTrailingAction:mount", /*handleSMUIChipsChipTrailingAction*/ ctx[24]);
						switch_instance.$on("SMUIChipsChipTrailingAction:unmount", /*SMUIChipsChipTrailingAction_unmount_handler*/ ctx[37]);
						create_component(switch_instance.$$.fragment);
						transition_in(switch_instance.$$.fragment, 1);
						mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
					} else {
						switch_instance = null;
					}
				} else if (switch_value) {
					const switch_instance_changes = (dirty[0] & /*tag, ripple, $nonInteractive, addClass, removeClass, addStyle, forwardEvents, use, className, selected, touch, internalClasses, internalStyles, style, $$restProps*/ 503369055)
					? get_spread_update(switch_instance_spread_levels, [
							dirty[0] & /*tag*/ 64 && { tag: /*tag*/ ctx[6] },
							dirty[0] & /*ripple, $nonInteractive, addClass, removeClass, addStyle, forwardEvents, use*/ 234930185 && {
								use: [
									[
										Ripple,
										{
											ripple: /*ripple*/ ctx[3] && !/*$nonInteractive*/ ctx[14],
											unbounded: false,
											addClass: /*addClass*/ ctx[25],
											removeClass: /*removeClass*/ ctx[26],
											addStyle: /*addStyle*/ ctx[27]
										}
									],
									/*forwardEvents*/ ctx[15],
									.../*use*/ ctx[0]
								]
							},
							dirty[0] & /*className, selected, touch, internalClasses*/ 1298 && {
								class: classMap({
									[/*className*/ ctx[1]]: true,
									'mdc-chip': true,
									'mdc-chip--selected': /*selected*/ ctx[8],
									'mdc-chip--touch': /*touch*/ ctx[4],
									.../*internalClasses*/ ctx[10]
								})
							},
							dirty[0] & /*internalStyles, style*/ 2052 && {
								style: Object.entries(/*internalStyles*/ ctx[11]).map(func$1).concat([/*style*/ ctx[2]]).join(' ')
							},
							switch_instance_spread_levels[4],
							dirty[0] & /*$$restProps*/ 268435456 && get_spread_object(/*$$restProps*/ ctx[28])
						])
					: {};

					if (dirty[0] & /*touch, ripple, $nonInteractive*/ 16408 | dirty[1] & /*$$scope*/ 128) {
						switch_instance_changes.$$scope = { dirty, ctx };
					}

					switch_instance.$set(switch_instance_changes);
				}
			},
			i(local) {
				if (current) return;
				if (switch_instance) transition_in(switch_instance.$$.fragment, local);
				current = true;
			},
			o(local) {
				if (switch_instance) transition_out(switch_instance.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(switch_instance_anchor);
				}

				/*switch_instance_binding*/ ctx[35](null);
				if (switch_instance) destroy_component(switch_instance, detaching);
			}
		};
	}

	const func$1 = ([name, value]) => `${name}: ${value};`;

	function instance_1$2($$self, $$props, $$invalidate) {
		const omit_props_names = [
			"use","class","style","chip","ripple","touch","shouldRemoveOnTrailingIconClick","shouldFocusPrimaryActionOnClick","component","tag","getElement"
		];

		let $$restProps = compute_rest_props($$props, omit_props_names);
		let $index;
		let $choice;
		let $leadingIconClassesStore;
		let $isSelectedStore;
		let $shouldRemoveOnTrailingIconClickStore;
		let $initialSelectedStore;
		let $nonInteractive;
		let { $$slots: slots = {}, $$scope } = $$props;
		const { MDCChipFoundation } = deprecated;
		const forwardEvents = forwardEventsBuilder(get_current_component());
		let { use = [] } = $$props;
		let { class: className = '' } = $$props;
		let { style = '' } = $$props;
		let { chip: chipId } = $$props;
		let { ripple = true } = $$props;
		let { touch = false } = $$props;
		let { shouldRemoveOnTrailingIconClick = true } = $$props;
		let { shouldFocusPrimaryActionOnClick = true } = $$props;
		let element;
		let instance;
		let internalClasses = {};
		let leadingIconClasses = {};
		let internalStyles = {};
		const initialSelectedStore = getContext('SMUI:chips:chip:initialSelected');
		component_subscribe($$self, initialSelectedStore, value => $$invalidate(44, $initialSelectedStore = value));
		let selected = $initialSelectedStore;
		let primaryActionAccessor = undefined;
		let trailingActionAccessor = undefined;
		const nonInteractive = getContext('SMUI:chips:nonInteractive');
		component_subscribe($$self, nonInteractive, value => $$invalidate(14, $nonInteractive = value));
		const choice = getContext('SMUI:chips:choice');
		component_subscribe($$self, choice, value => $$invalidate(40, $choice = value));
		const index = getContext('SMUI:chips:chip:index');
		component_subscribe($$self, index, value => $$invalidate(39, $index = value));
		let { component = SmuiElement } = $$props;
		let { tag = component === SmuiElement ? 'div' : undefined } = $$props;
		const shouldRemoveOnTrailingIconClickStore = writable(shouldRemoveOnTrailingIconClick);
		component_subscribe($$self, shouldRemoveOnTrailingIconClickStore, value => $$invalidate(43, $shouldRemoveOnTrailingIconClickStore = value));
		setContext('SMUI:chips:chip:shouldRemoveOnTrailingIconClick', shouldRemoveOnTrailingIconClickStore);
		const isSelectedStore = writable(selected);
		component_subscribe($$self, isSelectedStore, value => $$invalidate(42, $isSelectedStore = value));
		setContext('SMUI:chips:chip:isSelected', isSelectedStore);
		const leadingIconClassesStore = writable(leadingIconClasses);
		component_subscribe($$self, leadingIconClassesStore, value => $$invalidate(41, $leadingIconClassesStore = value));
		setContext('SMUI:chips:chip:leadingIconClasses', leadingIconClassesStore);
		setContext('SMUI:chips:chip:focusable', $choice && selected || $index === 0);

		if (!chipId) {
			throw new Error('The chip property is required! It should be passed down from the Set to the Chip.');
		}

		onMount(() => {
			$$invalidate(7, instance = new MDCChipFoundation({
					addClass,
					addClassToLeadingIcon: addLeadingIconClass,
					eventTargetHasClass: (target, className) => target && 'classList' in target
					? target.classList.contains(className)
					: false,
					focusPrimaryAction: () => {
						if (primaryActionAccessor) {
							primaryActionAccessor.focus();
						}
					},
					focusTrailingAction: () => {
						if (trailingActionAccessor) {
							trailingActionAccessor.focus();
						}
					},
					getAttribute: attr => getElement().getAttribute(attr),
					getCheckmarkBoundingClientRect: () => {
						const target = getElement().querySelector('.mdc-chip__checkmark');

						if (target) {
							return target.getBoundingClientRect();
						}

						return null;
					},
					getComputedStyleValue: getStyle,
					getRootBoundingClientRect: () => getElement().getBoundingClientRect(),
					hasClass,
					hasLeadingIcon: () => {
						const target = getElement().querySelector('.mdc-chip__icon--leading');
						return !!target;
					},
					isRTL: () => getComputedStyle(getElement()).getPropertyValue('direction') === 'rtl',
					isTrailingActionNavigable: () => {
						if (trailingActionAccessor) {
							return trailingActionAccessor.isNavigable();
						}

						return false;
					},
					notifyInteraction: () => dispatch(getElement(), 'SMUIChip:interaction', { chipId }, undefined, true),
					notifyNavigation: (key, source) => dispatch(getElement(), 'SMUIChip:navigation', { chipId, key, source }, undefined, true),
					notifyRemoval: removedAnnouncement => {
						dispatch(getElement(), 'SMUIChip:removal', { chipId, removedAnnouncement }, undefined, true);
					},
					notifySelection: (selected, shouldIgnore) => dispatch(getElement(), 'SMUIChip:selection', { chipId, selected, shouldIgnore }, undefined, true),
					notifyTrailingIconInteraction: () => dispatch(getElement(), 'SMUIChip:trailingIconInteraction', { chipId }, undefined, true),
					notifyEditStart: () => {
						
					}, /* Not Implemented. */
					notifyEditFinish: () => {
						
					}, /* Not Implemented. */
					removeClass,
					removeClassFromLeadingIcon: removeLeadingIconClass,
					removeTrailingActionFocus: () => {
						if (trailingActionAccessor) {
							trailingActionAccessor.removeFocus();
						}
					},
					setPrimaryActionAttr: (attr, value) => {
						if (primaryActionAccessor) {
							primaryActionAccessor.addAttr(attr, value);
						}
					},
					setStyleProperty: addStyle
				}));

			const accessor = {
				chipId,
				get selected() {
					return selected;
				},
				focusPrimaryAction,
				focusTrailingAction,
				removeFocus,
				setSelectedFromChipSet
			};

			dispatch(getElement(), 'SMUIChipsChip:mount', accessor);
			instance.init();

			return () => {
				dispatch(getElement(), 'SMUIChipsChip:unmount', accessor);
				instance.destroy();
			};
		});

		function handleSMUIChipsChipPrimaryAction(event) {
			$$invalidate(12, primaryActionAccessor = event.detail);
		}

		function handleSMUIChipsChipTrailingAction(event) {
			$$invalidate(13, trailingActionAccessor = event.detail);
		}

		function hasClass(className) {
			return className in internalClasses
			? internalClasses[className]
			: getElement().classList.contains(className);
		}

		function addClass(className) {
			if (!internalClasses[className]) {
				$$invalidate(10, internalClasses[className] = true, internalClasses);
			}
		}

		function removeClass(className) {
			if (!(className in internalClasses) || internalClasses[className]) {
				$$invalidate(10, internalClasses[className] = false, internalClasses);
			}
		}

		function addLeadingIconClass(className) {
			if (!leadingIconClasses[className]) {
				$$invalidate(33, leadingIconClasses[className] = true, leadingIconClasses);
			}
		}

		function removeLeadingIconClass(className) {
			if (!(className in leadingIconClasses) || leadingIconClasses[className]) {
				$$invalidate(33, leadingIconClasses[className] = false, leadingIconClasses);
			}
		}

		function addStyle(name, value) {
			if (internalStyles[name] != value) {
				if (value === '' || value == null) {
					delete internalStyles[name];
					$$invalidate(11, internalStyles);
				} else {
					$$invalidate(11, internalStyles[name] = value, internalStyles);
				}
			}
		}

		function getStyle(name) {
			return name in internalStyles
			? internalStyles[name]
			: getComputedStyle(getElement()).getPropertyValue(name);
		}

		function setSelectedFromChipSet(value, shouldNotifyClients) {
			$$invalidate(8, selected = value);
			instance.setSelectedFromChipSet(selected, shouldNotifyClients);
		}

		function focusPrimaryAction() {
			instance.focusPrimaryAction();
		}

		function focusTrailingAction() {
			instance.focusTrailingAction();
		}

		function removeFocus() {
			instance.removeFocus();
		}

		function getElement() {
			return element.getElement();
		}

		function switch_instance_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				element = $$value;
				$$invalidate(9, element);
			});
		}

		const SMUIChipsChipPrimaryAction_unmount_handler = () => $$invalidate(12, primaryActionAccessor = undefined);
		const SMUIChipsChipTrailingAction_unmount_handler = () => $$invalidate(13, trailingActionAccessor = undefined);

		$$self.$$set = $$new_props => {
			$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
			$$invalidate(28, $$restProps = compute_rest_props($$props, omit_props_names));
			if ('use' in $$new_props) $$invalidate(0, use = $$new_props.use);
			if ('class' in $$new_props) $$invalidate(1, className = $$new_props.class);
			if ('style' in $$new_props) $$invalidate(2, style = $$new_props.style);
			if ('chip' in $$new_props) $$invalidate(29, chipId = $$new_props.chip);
			if ('ripple' in $$new_props) $$invalidate(3, ripple = $$new_props.ripple);
			if ('touch' in $$new_props) $$invalidate(4, touch = $$new_props.touch);
			if ('shouldRemoveOnTrailingIconClick' in $$new_props) $$invalidate(30, shouldRemoveOnTrailingIconClick = $$new_props.shouldRemoveOnTrailingIconClick);
			if ('shouldFocusPrimaryActionOnClick' in $$new_props) $$invalidate(31, shouldFocusPrimaryActionOnClick = $$new_props.shouldFocusPrimaryActionOnClick);
			if ('component' in $$new_props) $$invalidate(5, component = $$new_props.component);
			if ('tag' in $$new_props) $$invalidate(6, tag = $$new_props.tag);
			if ('$$scope' in $$new_props) $$invalidate(38, $$scope = $$new_props.$$scope);
		};

		$$self.$$.update = () => {
			if ($$self.$$.dirty[0] & /*shouldRemoveOnTrailingIconClick*/ 1073741824) {
				set_store_value(shouldRemoveOnTrailingIconClickStore, $shouldRemoveOnTrailingIconClickStore = shouldRemoveOnTrailingIconClick, $shouldRemoveOnTrailingIconClickStore);
			}

			if ($$self.$$.dirty[0] & /*selected*/ 256) {
				set_store_value(isSelectedStore, $isSelectedStore = selected, $isSelectedStore);
			}

			if ($$self.$$.dirty[1] & /*leadingIconClasses*/ 4) {
				set_store_value(leadingIconClassesStore, $leadingIconClassesStore = leadingIconClasses, $leadingIconClassesStore);
			}

			if ($$self.$$.dirty[0] & /*instance, shouldRemoveOnTrailingIconClick*/ 1073741952) {
				if (instance && instance.getShouldRemoveOnTrailingIconClick() !== shouldRemoveOnTrailingIconClick) {
					instance.setShouldRemoveOnTrailingIconClick(shouldRemoveOnTrailingIconClick);
				}
			}

			if ($$self.$$.dirty[0] & /*instance*/ 128 | $$self.$$.dirty[1] & /*shouldFocusPrimaryActionOnClick*/ 1) {
				if (instance) {
					instance.setShouldFocusPrimaryActionOnClick(shouldFocusPrimaryActionOnClick);
				}
			}
		};

		return [
			use,
			className,
			style,
			ripple,
			touch,
			component,
			tag,
			instance,
			selected,
			element,
			internalClasses,
			internalStyles,
			primaryActionAccessor,
			trailingActionAccessor,
			$nonInteractive,
			forwardEvents,
			initialSelectedStore,
			nonInteractive,
			choice,
			index,
			shouldRemoveOnTrailingIconClickStore,
			isSelectedStore,
			leadingIconClassesStore,
			handleSMUIChipsChipPrimaryAction,
			handleSMUIChipsChipTrailingAction,
			addClass,
			removeClass,
			addStyle,
			$$restProps,
			chipId,
			shouldRemoveOnTrailingIconClick,
			shouldFocusPrimaryActionOnClick,
			getElement,
			leadingIconClasses,
			slots,
			switch_instance_binding,
			SMUIChipsChipPrimaryAction_unmount_handler,
			SMUIChipsChipTrailingAction_unmount_handler,
			$$scope
		];
	}

	class Chip extends SvelteComponent {
		constructor(options) {
			super();

			init(
				this,
				options,
				instance_1$2,
				create_fragment$9,
				safe_not_equal,
				{
					use: 0,
					class: 1,
					style: 2,
					chip: 29,
					ripple: 3,
					touch: 4,
					shouldRemoveOnTrailingIconClick: 30,
					shouldFocusPrimaryActionOnClick: 31,
					component: 5,
					tag: 6,
					getElement: 32
				},
				null,
				[-1, -1]
			);
		}

		get getElement() {
			return this.$$.ctx[32];
		}
	}

	/* node_modules/@smui/chips/dist/Set.svelte generated by Svelte v4.2.7 */

	function get_each_context$1(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[37] = list[i];
		child_ctx[39] = i;
		return child_ctx;
	}

	const get_default_slot_changes = dirty => ({ chip: dirty[0] & /*chips*/ 1 });
	const get_default_slot_context = ctx => ({ chip: /*chip*/ ctx[37] });

	// (24:6) <ContextFragment         key="SMUI:chips:chip:initialSelected"         value={initialSelected[i]}       >
	function create_default_slot_1$2(ctx) {
		let current;
		const default_slot_template = /*#slots*/ ctx[25].default;
		const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[27], get_default_slot_context);

		return {
			c() {
				if (default_slot) default_slot.c();
			},
			m(target, anchor) {
				if (default_slot) {
					default_slot.m(target, anchor);
				}

				current = true;
			},
			p(ctx, dirty) {
				if (default_slot) {
					if (default_slot.p && (!current || dirty[0] & /*$$scope, chips*/ 134217729)) {
						update_slot_base(
							default_slot,
							default_slot_template,
							ctx,
							/*$$scope*/ ctx[27],
							!current
							? get_all_dirty_from_scope(/*$$scope*/ ctx[27])
							: get_slot_changes(default_slot_template, /*$$scope*/ ctx[27], dirty, get_default_slot_changes),
							get_default_slot_context
						);
					}
				}
			},
			i(local) {
				if (current) return;
				transition_in(default_slot, local);
				current = true;
			},
			o(local) {
				transition_out(default_slot, local);
				current = false;
			},
			d(detaching) {
				if (default_slot) default_slot.d(detaching);
			}
		};
	}

	// (23:4) <ContextFragment key="SMUI:chips:chip:index" value={i}>
	function create_default_slot$3(ctx) {
		let contextfragment;
		let t;
		let current;

		contextfragment = new ContextFragment({
				props: {
					key: "SMUI:chips:chip:initialSelected",
					value: /*initialSelected*/ ctx[10][/*i*/ ctx[39]],
					$$slots: { default: [create_default_slot_1$2] },
					$$scope: { ctx }
				}
			});

		return {
			c() {
				create_component(contextfragment.$$.fragment);
				t = space();
			},
			m(target, anchor) {
				mount_component(contextfragment, target, anchor);
				insert(target, t, anchor);
				current = true;
			},
			p(ctx, dirty) {
				const contextfragment_changes = {};
				if (dirty[0] & /*chips*/ 1) contextfragment_changes.value = /*initialSelected*/ ctx[10][/*i*/ ctx[39]];

				if (dirty[0] & /*$$scope, chips*/ 134217729) {
					contextfragment_changes.$$scope = { dirty, ctx };
				}

				contextfragment.$set(contextfragment_changes);
			},
			i(local) {
				if (current) return;
				transition_in(contextfragment.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(contextfragment.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(t);
				}

				destroy_component(contextfragment, detaching);
			}
		};
	}

	// (22:2) {#each chips as chip, i (key(chip))}
	function create_each_block$1(key_2, ctx) {
		let first;
		let contextfragment;
		let current;

		contextfragment = new ContextFragment({
				props: {
					key: "SMUI:chips:chip:index",
					value: /*i*/ ctx[39],
					$$slots: { default: [create_default_slot$3] },
					$$scope: { ctx }
				}
			});

		return {
			key: key_2,
			first: null,
			c() {
				first = empty();
				create_component(contextfragment.$$.fragment);
				this.first = first;
			},
			m(target, anchor) {
				insert(target, first, anchor);
				mount_component(contextfragment, target, anchor);
				current = true;
			},
			p(new_ctx, dirty) {
				ctx = new_ctx;
				const contextfragment_changes = {};
				if (dirty[0] & /*chips*/ 1) contextfragment_changes.value = /*i*/ ctx[39];

				if (dirty[0] & /*$$scope, chips*/ 134217729) {
					contextfragment_changes.$$scope = { dirty, ctx };
				}

				contextfragment.$set(contextfragment_changes);
			},
			i(local) {
				if (current) return;
				transition_in(contextfragment.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(contextfragment.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(first);
				}

				destroy_component(contextfragment, detaching);
			}
		};
	}

	function create_fragment$8(ctx) {
		let div;
		let each_blocks = [];
		let each_1_lookup = new Map();
		let div_class_value;
		let useActions_action;
		let current;
		let mounted;
		let dispose;
		let each_value = ensure_array_like(/*chips*/ ctx[0]);
		const get_key = ctx => /*key*/ ctx[3](/*chip*/ ctx[37]);

		for (let i = 0; i < each_value.length; i += 1) {
			let child_ctx = get_each_context$1(ctx, each_value, i);
			let key = get_key(child_ctx);
			each_1_lookup.set(key, each_blocks[i] = create_each_block$1(key, child_ctx));
		}

		let div_levels = [
			{
				class: div_class_value = classMap({
					[/*className*/ ctx[2]]: true,
					'mdc-chip-set': true,
					'smui-chip-set--non-interactive': /*nonInteractive*/ ctx[4],
					'mdc-chip-set--choice': /*choice*/ ctx[5],
					'mdc-chip-set--filter': /*filter*/ ctx[6],
					'mdc-chip-set--input': /*input*/ ctx[7]
				})
			},
			{ role: "grid" },
			/*$$restProps*/ ctx[20]
		];

		let div_data = {};

		for (let i = 0; i < div_levels.length; i += 1) {
			div_data = assign(div_data, div_levels[i]);
		}

		return {
			c() {
				div = element("div");

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				set_attributes(div, div_data);
			},
			m(target, anchor) {
				insert(target, div, anchor);

				for (let i = 0; i < each_blocks.length; i += 1) {
					if (each_blocks[i]) {
						each_blocks[i].m(div, null);
					}
				}

				/*div_binding*/ ctx[26](div);
				current = true;

				if (!mounted) {
					dispose = [
						action_destroyer(useActions_action = useActions.call(null, div, /*use*/ ctx[1])),
						action_destroyer(/*forwardEvents*/ ctx[9].call(null, div)),
						listen$1(div, "SMUIChipsChip:mount", /*handleChipMount*/ ctx[14]),
						listen$1(div, "SMUIChipsChip:unmount", /*handleChipUnmount*/ ctx[15]),
						listen$1(div, "SMUIChip:interaction", /*handleChipInteraction*/ ctx[16]),
						listen$1(div, "SMUIChip:selection", /*handleChipSelection*/ ctx[17]),
						listen$1(div, "SMUIChip:removal", /*handleChipRemoval*/ ctx[18]),
						listen$1(div, "SMUIChip:navigation", /*handleChipNavigation*/ ctx[19])
					];

					mounted = true;
				}
			},
			p(ctx, dirty) {
				if (dirty[0] & /*chips, initialSelected, $$scope, key*/ 134218761) {
					each_value = ensure_array_like(/*chips*/ ctx[0]);
					group_outros();
					each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, div, outro_and_destroy_block, create_each_block$1, null, get_each_context$1);
					check_outros();
				}

				set_attributes(div, div_data = get_spread_update(div_levels, [
					(!current || dirty[0] & /*className, nonInteractive, choice, filter, input*/ 244 && div_class_value !== (div_class_value = classMap({
						[/*className*/ ctx[2]]: true,
						'mdc-chip-set': true,
						'smui-chip-set--non-interactive': /*nonInteractive*/ ctx[4],
						'mdc-chip-set--choice': /*choice*/ ctx[5],
						'mdc-chip-set--filter': /*filter*/ ctx[6],
						'mdc-chip-set--input': /*input*/ ctx[7]
					}))) && { class: div_class_value },
					{ role: "grid" },
					dirty[0] & /*$$restProps*/ 1048576 && /*$$restProps*/ ctx[20]
				]));

				if (useActions_action && is_function(useActions_action.update) && dirty[0] & /*use*/ 2) useActions_action.update.call(null, /*use*/ ctx[1]);
			},
			i(local) {
				if (current) return;

				for (let i = 0; i < each_value.length; i += 1) {
					transition_in(each_blocks[i]);
				}

				current = true;
			},
			o(local) {
				for (let i = 0; i < each_blocks.length; i += 1) {
					transition_out(each_blocks[i]);
				}

				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(div);
				}

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].d();
				}

				/*div_binding*/ ctx[26](null);
				mounted = false;
				run_all(dispose);
			}
		};
	}

	function setDifference(setA, setB) {
		let _difference = new Set(setA);

		for (let elem of setB) {
			_difference.delete(elem);
		}

		return _difference;
	}

	function instance_1$1($$self, $$props, $$invalidate) {
		const omit_props_names = [
			"use","class","chips","key","selected","nonInteractive","choice","filter","input","getElement"
		];

		let $$restProps = compute_rest_props($$props, omit_props_names);
		let $filterStore;
		let $choiceStore;
		let $nonInteractiveStore;
		let { $$slots: slots = {}, $$scope } = $$props;
		const { MDCChipSetFoundation } = deprecated;
		const forwardEvents = forwardEventsBuilder(get_current_component());
		let { use = [] } = $$props;
		let { class: className = '' } = $$props;
		let { chips = [] } = $$props;
		let { key = chip => chip } = $$props;
		let { selected = undefined } = $$props;
		let { nonInteractive = false } = $$props;
		let { choice = false } = $$props;
		let { filter = false } = $$props;
		let { input = false } = $$props;
		let element;
		let instance;
		let chipAccessorMap = {};
		let chipAccessorWeakMap = new WeakMap();
		let initialSelected = chips.map(chipId => choice && selected === chipId || filter && selected.indexOf(chipId) !== -1);
		const nonInteractiveStore = writable(nonInteractive);
		component_subscribe($$self, nonInteractiveStore, value => $$invalidate(31, $nonInteractiveStore = value));
		setContext('SMUI:chips:nonInteractive', nonInteractiveStore);
		const choiceStore = writable(choice);
		component_subscribe($$self, choiceStore, value => $$invalidate(30, $choiceStore = value));
		setContext('SMUI:chips:choice', choiceStore);
		const filterStore = writable(filter);
		component_subscribe($$self, filterStore, value => $$invalidate(29, $filterStore = value));
		setContext('SMUI:chips:filter', filterStore);
		let previousSelected = filter ? new Set(selected) : selected;

		onMount(() => {
			$$invalidate(23, instance = new MDCChipSetFoundation({
					announceMessage: announce$1,
					focusChipPrimaryActionAtIndex: index => {
						var _a;

						(_a = getAccessor(chips[index])) === null || _a === void 0
						? void 0
						: _a.focusPrimaryAction();
					},
					focusChipTrailingActionAtIndex: index => {
						var _a;

						(_a = getAccessor(chips[index])) === null || _a === void 0
						? void 0
						: _a.focusTrailingAction();
					},
					getChipListCount: () => chips.length,
					getIndexOfChipById: chipId => chips.indexOf(chipId),
					hasClass: className => getElement().classList.contains(className),
					isRTL: () => getComputedStyle(getElement()).getPropertyValue('direction') === 'rtl',
					removeChipAtIndex: index => {
						if (index >= 0 && index < chips.length) {
							if (choice && selected === chips[index]) {
								$$invalidate(21, selected = null);
							} else if (filter && selected.indexOf(chips[index]) !== -1) {
								selected.splice(selected.indexOf(chips[index]), 1);
								$$invalidate(21, selected);
							}

							chips.splice(index, 1);
							$$invalidate(0, chips);
						}
					},
					removeFocusFromChipAtIndex: index => {
						var _a;

						(_a = getAccessor(chips[index])) === null || _a === void 0
						? void 0
						: _a.removeFocus();
					},
					selectChipAtIndex: (index, selectedValue, shouldNotifyClients) => {
						var _a;

						if (index >= 0 && index < chips.length) {
							if (filter) {
								const selIndex = selected.indexOf(chips[index]);

								if (selectedValue && selIndex === -1) {
									selected.push(chips[index]);
									$$invalidate(21, selected);
								} else if (!selectedValue && selIndex !== -1) {
									selected.splice(selIndex, 1);
									$$invalidate(21, selected);
								}
							} else if (choice && (selectedValue || selected === chips[index])) {
								$$invalidate(21, selected = selectedValue ? chips[index] : null);
							}

							(_a = getAccessor(chips[index])) === null || _a === void 0
							? void 0
							: _a.setSelectedFromChipSet(selectedValue, shouldNotifyClients);
						}
					}
				}));

			instance.init();

			if (choice && selected != null) {
				instance.select(selected);
			} else if (filter && selected.length) {
				for (const chipId of selected) {
					instance.select(chipId);
				}
			}

			return () => {
				instance.destroy();
			};
		});

		function handleChipMount(event) {
			const accessor = event.detail;
			addAccessor(accessor.chipId, accessor);
		}

		function handleChipUnmount(event) {
			const accessor = event.detail;
			removeAccessor(accessor.chipId);
		}

		function handleChipInteraction(event) {
			if (instance) {
				instance.handleChipInteraction(event.detail);
			}
		}

		function handleChipSelection(event) {
			if (instance) {
				instance.handleChipSelection(event.detail);
			}
		}

		function handleChipRemoval(event) {
			if (instance) {
				instance.handleChipRemoval(event.detail);
			}
		}

		function handleChipNavigation(event) {
			if (instance) {
				instance.handleChipNavigation(event.detail);
			}
		}

		function getAccessor(chipId) {
			return chipId instanceof Object
			? chipAccessorWeakMap.get(chipId)
			: chipAccessorMap[chipId];
		}

		function addAccessor(chipId, accessor) {
			if (chipId instanceof Object) {
				chipAccessorWeakMap.set(chipId, accessor);
			} else {
				chipAccessorMap[chipId] = accessor;
			}
		}

		function removeAccessor(chipId) {
			if (chipId instanceof Object) {
				chipAccessorWeakMap.delete(chipId);
			} else {
				delete chipAccessorMap[chipId];
			}
		}

		function getElement() {
			return element;
		}

		function div_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				element = $$value;
				$$invalidate(8, element);
			});
		}

		$$self.$$set = $$new_props => {
			$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
			$$invalidate(20, $$restProps = compute_rest_props($$props, omit_props_names));
			if ('use' in $$new_props) $$invalidate(1, use = $$new_props.use);
			if ('class' in $$new_props) $$invalidate(2, className = $$new_props.class);
			if ('chips' in $$new_props) $$invalidate(0, chips = $$new_props.chips);
			if ('key' in $$new_props) $$invalidate(3, key = $$new_props.key);
			if ('selected' in $$new_props) $$invalidate(21, selected = $$new_props.selected);
			if ('nonInteractive' in $$new_props) $$invalidate(4, nonInteractive = $$new_props.nonInteractive);
			if ('choice' in $$new_props) $$invalidate(5, choice = $$new_props.choice);
			if ('filter' in $$new_props) $$invalidate(6, filter = $$new_props.filter);
			if ('input' in $$new_props) $$invalidate(7, input = $$new_props.input);
			if ('$$scope' in $$new_props) $$invalidate(27, $$scope = $$new_props.$$scope);
		};

		$$self.$$.update = () => {
			if ($$self.$$.dirty[0] & /*nonInteractive*/ 16) {
				set_store_value(nonInteractiveStore, $nonInteractiveStore = nonInteractive, $nonInteractiveStore);
			}

			if ($$self.$$.dirty[0] & /*choice*/ 32) {
				set_store_value(choiceStore, $choiceStore = choice, $choiceStore);
			}

			if ($$self.$$.dirty[0] & /*filter*/ 64) {
				set_store_value(filterStore, $filterStore = filter, $filterStore);
			}

			if ($$self.$$.dirty[0] & /*instance, choice, previousSelected, selected*/ 27263008) {
				if (instance && choice && previousSelected !== selected) {
					$$invalidate(24, previousSelected = selected);
					instance.select(selected);
				}
			}

			if ($$self.$$.dirty[0] & /*instance, filter, selected, previousSelected, chips*/ 27263041) {
				if (instance && filter) {
					const setSelected = new Set(selected);
					const unSelected = setDifference(previousSelected, setSelected);
					const newSelected = setDifference(setSelected, previousSelected);

					if (unSelected.size || newSelected.size) {
						$$invalidate(24, previousSelected = setSelected);

						for (let chipId of unSelected) {
							if (chips.indexOf(chipId) !== -1) {
								instance.handleChipSelection({ chipId, selected: false });
							}
						}

						for (let chipId of newSelected) {
							instance.handleChipSelection({ chipId, selected: true });
						}
					}
				}
			}
		};

		return [
			chips,
			use,
			className,
			key,
			nonInteractive,
			choice,
			filter,
			input,
			element,
			forwardEvents,
			initialSelected,
			nonInteractiveStore,
			choiceStore,
			filterStore,
			handleChipMount,
			handleChipUnmount,
			handleChipInteraction,
			handleChipSelection,
			handleChipRemoval,
			handleChipNavigation,
			$$restProps,
			selected,
			getElement,
			instance,
			previousSelected,
			slots,
			div_binding,
			$$scope
		];
	}

	class Set_1 extends SvelteComponent {
		constructor(options) {
			super();

			init(
				this,
				options,
				instance_1$1,
				create_fragment$8,
				safe_not_equal,
				{
					use: 1,
					class: 2,
					chips: 0,
					key: 3,
					selected: 21,
					nonInteractive: 4,
					choice: 5,
					filter: 6,
					input: 7,
					getElement: 22
				},
				null,
				[-1, -1]
			);
		}

		get getElement() {
			return this.$$.ctx[22];
		}
	}

	/* node_modules/@smui/chips/dist/Checkmark.svelte generated by Svelte v4.2.7 */

	function create_fragment$7(ctx) {
		let span;
		let svg;
		let path;
		let span_class_value;
		let useActions_action;
		let mounted;
		let dispose;

		let span_levels = [
			{
				class: span_class_value = classMap({
					[/*className*/ ctx[1]]: true,
					'mdc-chip__checkmark': true
				})
			},
			/*$$restProps*/ ctx[3]
		];

		let span_data = {};

		for (let i = 0; i < span_levels.length; i += 1) {
			span_data = assign(span_data, span_levels[i]);
		}

		return {
			c() {
				span = element("span");
				svg = svg_element("svg");
				path = svg_element("path");
				attr(path, "class", "mdc-chip__checkmark-path");
				attr(path, "fill", "none");
				attr(path, "stroke", "black");
				attr(path, "d", "M1.73,12.91 8.1,19.28 22.79,4.59");
				attr(svg, "class", "mdc-chip__checkmark-svg");
				attr(svg, "viewBox", "-2 -3 30 30");
				set_attributes(span, span_data);
			},
			m(target, anchor) {
				insert(target, span, anchor);
				append(span, svg);
				append(svg, path);
				/*span_binding*/ ctx[5](span);

				if (!mounted) {
					dispose = action_destroyer(useActions_action = useActions.call(null, span, /*use*/ ctx[0]));
					mounted = true;
				}
			},
			p(ctx, [dirty]) {
				set_attributes(span, span_data = get_spread_update(span_levels, [
					dirty & /*className*/ 2 && span_class_value !== (span_class_value = classMap({
						[/*className*/ ctx[1]]: true,
						'mdc-chip__checkmark': true
					})) && { class: span_class_value },
					dirty & /*$$restProps*/ 8 && /*$$restProps*/ ctx[3]
				]));

				if (useActions_action && is_function(useActions_action.update) && dirty & /*use*/ 1) useActions_action.update.call(null, /*use*/ ctx[0]);
			},
			i: noop,
			o: noop,
			d(detaching) {
				if (detaching) {
					detach(span);
				}

				/*span_binding*/ ctx[5](null);
				mounted = false;
				dispose();
			}
		};
	}

	function instance$6($$self, $$props, $$invalidate) {
		const omit_props_names = ["use","class","getElement"];
		let $$restProps = compute_rest_props($$props, omit_props_names);
		let { use = [] } = $$props;
		let { class: className = '' } = $$props;
		let element;

		function getElement() {
			return element;
		}

		function span_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				element = $$value;
				$$invalidate(2, element);
			});
		}

		$$self.$$set = $$new_props => {
			$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
			$$invalidate(3, $$restProps = compute_rest_props($$props, omit_props_names));
			if ('use' in $$new_props) $$invalidate(0, use = $$new_props.use);
			if ('class' in $$new_props) $$invalidate(1, className = $$new_props.class);
		};

		return [use, className, element, $$restProps, getElement, span_binding];
	}

	class Checkmark extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance$6, create_fragment$7, safe_not_equal, { use: 0, class: 1, getElement: 4 });
		}

		get getElement() {
			return this.$$.ctx[4];
		}
	}

	/* node_modules/@smui/chips/dist/Text.svelte generated by Svelte v4.2.7 */

	function create_if_block_1$1(ctx) {
		let checkmark;
		let current;
		let checkmark_props = {};
		checkmark = new Checkmark({ props: checkmark_props });
		/*checkmark_binding*/ ctx[23](checkmark);

		return {
			c() {
				create_component(checkmark.$$.fragment);
			},
			m(target, anchor) {
				mount_component(checkmark, target, anchor);
				current = true;
			},
			p(ctx, dirty) {
				const checkmark_changes = {};
				checkmark.$set(checkmark_changes);
			},
			i(local) {
				if (current) return;
				transition_in(checkmark.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(checkmark.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				/*checkmark_binding*/ ctx[23](null);
				destroy_component(checkmark, detaching);
			}
		};
	}

	// (12:2) {:else}
	function create_else_block$1(ctx) {
		let span1;
		let span0;
		let span1_class_value;
		let current;
		const default_slot_template = /*#slots*/ ctx[22].default;
		const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[21], null);

		let span1_levels = [
			{
				class: span1_class_value = classMap({
					[/*className*/ ctx[1]]: true,
					'mdc-chip__primary-action': true
				})
			},
			/*$filter*/ ctx[3] || /*$choice*/ ctx[2]
			? {
					'aria-selected': /*$isSelected*/ ctx[10] ? 'true' : 'false'
				}
			: {},
			/*roleProps*/ ctx[8],
			/*internalAttrs*/ ctx[7],
			/*$$restProps*/ ctx[16]
		];

		let span_data_1 = {};

		for (let i = 0; i < span1_levels.length; i += 1) {
			span_data_1 = assign(span_data_1, span1_levels[i]);
		}

		return {
			c() {
				span1 = element("span");
				span0 = element("span");
				if (default_slot) default_slot.c();
				attr(span0, "class", "mdc-chip__text");
				set_attributes(span1, span_data_1);
			},
			m(target, anchor) {
				insert(target, span1, anchor);
				append(span1, span0);

				if (default_slot) {
					default_slot.m(span0, null);
				}

				/*span1_binding*/ ctx[24](span1);
				current = true;
			},
			p(ctx, dirty) {
				if (default_slot) {
					if (default_slot.p && (!current || dirty & /*$$scope*/ 2097152)) {
						update_slot_base(
							default_slot,
							default_slot_template,
							ctx,
							/*$$scope*/ ctx[21],
							!current
							? get_all_dirty_from_scope(/*$$scope*/ ctx[21])
							: get_slot_changes(default_slot_template, /*$$scope*/ ctx[21], dirty, null),
							null
						);
					}
				}

				set_attributes(span1, span_data_1 = get_spread_update(span1_levels, [
					(!current || dirty & /*className*/ 2 && span1_class_value !== (span1_class_value = classMap({
						[/*className*/ ctx[1]]: true,
						'mdc-chip__primary-action': true
					}))) && { class: span1_class_value },
					dirty & /*$filter, $choice, $isSelected*/ 1036 && (/*$filter*/ ctx[3] || /*$choice*/ ctx[2]
					? {
							'aria-selected': /*$isSelected*/ ctx[10] ? 'true' : 'false'
						}
					: {}),
					dirty & /*roleProps*/ 256 && /*roleProps*/ ctx[8],
					dirty & /*internalAttrs*/ 128 && /*internalAttrs*/ ctx[7],
					dirty & /*$$restProps*/ 65536 && /*$$restProps*/ ctx[16]
				]));
			},
			i(local) {
				if (current) return;
				transition_in(default_slot, local);
				current = true;
			},
			o(local) {
				transition_out(default_slot, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(span1);
				}

				if (default_slot) default_slot.d(detaching);
				/*span1_binding*/ ctx[24](null);
			}
		};
	}

	// (10:2) {#if $nonInteractive}
	function create_if_block$2(ctx) {
		let span;
		let current;
		const default_slot_template = /*#slots*/ ctx[22].default;
		const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[21], null);

		return {
			c() {
				span = element("span");
				if (default_slot) default_slot.c();
				attr(span, "class", "mdc-chip__text");
			},
			m(target, anchor) {
				insert(target, span, anchor);

				if (default_slot) {
					default_slot.m(span, null);
				}

				current = true;
			},
			p(ctx, dirty) {
				if (default_slot) {
					if (default_slot.p && (!current || dirty & /*$$scope*/ 2097152)) {
						update_slot_base(
							default_slot,
							default_slot_template,
							ctx,
							/*$$scope*/ ctx[21],
							!current
							? get_all_dirty_from_scope(/*$$scope*/ ctx[21])
							: get_slot_changes(default_slot_template, /*$$scope*/ ctx[21], dirty, null),
							null
						);
					}
				}
			},
			i(local) {
				if (current) return;
				transition_in(default_slot, local);
				current = true;
			},
			o(local) {
				transition_out(default_slot, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(span);
				}

				if (default_slot) default_slot.d(detaching);
			}
		};
	}

	function create_fragment$6(ctx) {
		let t;
		let span;
		let current_block_type_index;
		let if_block1;
		let useActions_action;
		let current;
		let mounted;
		let dispose;
		let if_block0 = /*$filter*/ ctx[3] && create_if_block_1$1(ctx);
		const if_block_creators = [create_if_block$2, create_else_block$1];
		const if_blocks = [];

		function select_block_type(ctx, dirty) {
			if (/*$nonInteractive*/ ctx[9]) return 0;
			return 1;
		}

		current_block_type_index = select_block_type(ctx);
		if_block1 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

		return {
			c() {
				if (if_block0) if_block0.c();
				t = space();
				span = element("span");
				if_block1.c();
				attr(span, "role", "gridcell");
			},
			m(target, anchor) {
				if (if_block0) if_block0.m(target, anchor);
				insert(target, t, anchor);
				insert(target, span, anchor);
				if_blocks[current_block_type_index].m(span, null);
				/*span_binding*/ ctx[25](span);
				current = true;

				if (!mounted) {
					dispose = [
						action_destroyer(useActions_action = useActions.call(null, span, /*use*/ ctx[0])),
						action_destroyer(/*forwardEvents*/ ctx[11].call(null, span))
					];

					mounted = true;
				}
			},
			p(ctx, [dirty]) {
				if (/*$filter*/ ctx[3]) {
					if (if_block0) {
						if_block0.p(ctx, dirty);

						if (dirty & /*$filter*/ 8) {
							transition_in(if_block0, 1);
						}
					} else {
						if_block0 = create_if_block_1$1(ctx);
						if_block0.c();
						transition_in(if_block0, 1);
						if_block0.m(t.parentNode, t);
					}
				} else if (if_block0) {
					group_outros();

					transition_out(if_block0, 1, 1, () => {
						if_block0 = null;
					});

					check_outros();
				}

				let previous_block_index = current_block_type_index;
				current_block_type_index = select_block_type(ctx);

				if (current_block_type_index === previous_block_index) {
					if_blocks[current_block_type_index].p(ctx, dirty);
				} else {
					group_outros();

					transition_out(if_blocks[previous_block_index], 1, 1, () => {
						if_blocks[previous_block_index] = null;
					});

					check_outros();
					if_block1 = if_blocks[current_block_type_index];

					if (!if_block1) {
						if_block1 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
						if_block1.c();
					} else {
						if_block1.p(ctx, dirty);
					}

					transition_in(if_block1, 1);
					if_block1.m(span, null);
				}

				if (useActions_action && is_function(useActions_action.update) && dirty & /*use*/ 1) useActions_action.update.call(null, /*use*/ ctx[0]);
			},
			i(local) {
				if (current) return;
				transition_in(if_block0);
				transition_in(if_block1);
				current = true;
			},
			o(local) {
				transition_out(if_block0);
				transition_out(if_block1);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(t);
					detach(span);
				}

				if (if_block0) if_block0.d(detaching);
				if_blocks[current_block_type_index].d();
				/*span_binding*/ ctx[25](null);
				mounted = false;
				run_all(dispose);
			}
		};
	}

	function instance$5($$self, $$props, $$invalidate) {
		let roleProps;
		const omit_props_names = ["use","class","tabindex","focus","getInput","getElement"];
		let $$restProps = compute_rest_props($$props, omit_props_names);
		let $choice;
		let $filter;
		let $nonInteractive;
		let $isSelected;
		let { $$slots: slots = {}, $$scope } = $$props;
		const forwardEvents = forwardEventsBuilder(get_current_component());
		let { use = [] } = $$props;
		let { class: className = '' } = $$props;
		let { tabindex = getContext('SMUI:chips:chip:focusable') ? 0 : -1 } = $$props;
		let element;
		let input = undefined;
		let primaryAction = undefined;
		let internalAttrs = {};
		const nonInteractive = getContext('SMUI:chips:nonInteractive');
		component_subscribe($$self, nonInteractive, value => $$invalidate(9, $nonInteractive = value));
		const choice = getContext('SMUI:chips:choice');
		component_subscribe($$self, choice, value => $$invalidate(2, $choice = value));
		const filter = getContext('SMUI:chips:filter');
		component_subscribe($$self, filter, value => $$invalidate(3, $filter = value));
		const isSelected = getContext('SMUI:chips:chip:isSelected');
		component_subscribe($$self, isSelected, value => $$invalidate(10, $isSelected = value));

		onMount(() => {
			let accessor = { focus, addAttr };
			dispatch(getElement(), 'SMUIChipsChipPrimaryAction:mount', accessor);

			return () => {
				dispatch(getElement(), 'SMUIChipsChipPrimaryAction:unmount', accessor);
			};
		});

		function addAttr(name, value) {
			if (internalAttrs[name] !== value) {
				$$invalidate(7, internalAttrs[name] = value, internalAttrs);
			}
		}

		function waitForTabindex(fn) {
			if (internalAttrs['tabindex'] !== element.getAttribute('tabindex')) {
				tick().then(fn);
			} else {
				fn();
			}
		}

		function focus() {
			// Let the tabindex change propagate.
			waitForTabindex(() => {
				primaryAction && primaryAction.focus();
			});
		}

		function getInput() {
			return input && input.getElement();
		}

		function getElement() {
			return element;
		}

		function checkmark_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				input = $$value;
				$$invalidate(5, input);
			});
		}

		function span1_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				primaryAction = $$value;
				$$invalidate(6, primaryAction);
			});
		}

		function span_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				element = $$value;
				$$invalidate(4, element);
			});
		}

		$$self.$$set = $$new_props => {
			$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
			$$invalidate(16, $$restProps = compute_rest_props($$props, omit_props_names));
			if ('use' in $$new_props) $$invalidate(0, use = $$new_props.use);
			if ('class' in $$new_props) $$invalidate(1, className = $$new_props.class);
			if ('tabindex' in $$new_props) $$invalidate(17, tabindex = $$new_props.tabindex);
			if ('$$scope' in $$new_props) $$invalidate(21, $$scope = $$new_props.$$scope);
		};

		$$self.$$.update = () => {
			if ($$self.$$.dirty & /*$filter, $choice, tabindex*/ 131084) {
				$$invalidate(8, roleProps = {
					role: $filter ? 'checkbox' : $choice ? 'radio' : 'button',
					tabindex
				});
			}
		};

		return [
			use,
			className,
			$choice,
			$filter,
			element,
			input,
			primaryAction,
			internalAttrs,
			roleProps,
			$nonInteractive,
			$isSelected,
			forwardEvents,
			nonInteractive,
			choice,
			filter,
			isSelected,
			$$restProps,
			tabindex,
			focus,
			getInput,
			getElement,
			$$scope,
			slots,
			checkmark_binding,
			span1_binding,
			span_binding
		];
	}

	class Text extends SvelteComponent {
		constructor(options) {
			super();

			init(this, options, instance$5, create_fragment$6, safe_not_equal, {
				use: 0,
				class: 1,
				tabindex: 17,
				focus: 18,
				getInput: 19,
				getElement: 20
			});
		}

		get focus() {
			return this.$$.ctx[18];
		}

		get getInput() {
			return this.$$.ctx[19];
		}

		get getElement() {
			return this.$$.ctx[20];
		}
	}

	/**
	 * @license
	 * Copyright 2017 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */
	var cssClasses = {
	    ROOT: 'mdc-form-field',
	};
	var strings = {
	    LABEL_SELECTOR: '.mdc-form-field > label',
	};

	/**
	 * @license
	 * Copyright 2017 Google Inc.
	 *
	 * Permission is hereby granted, free of charge, to any person obtaining a copy
	 * of this software and associated documentation files (the "Software"), to deal
	 * in the Software without restriction, including without limitation the rights
	 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	 * copies of the Software, and to permit persons to whom the Software is
	 * furnished to do so, subject to the following conditions:
	 *
	 * The above copyright notice and this permission notice shall be included in
	 * all copies or substantial portions of the Software.
	 *
	 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	 * THE SOFTWARE.
	 */
	var MDCFormFieldFoundation = /** @class */ (function (_super) {
	    __extends(MDCFormFieldFoundation, _super);
	    function MDCFormFieldFoundation(adapter) {
	        var _this = _super.call(this, __assign(__assign({}, MDCFormFieldFoundation.defaultAdapter), adapter)) || this;
	        _this.click = function () {
	            _this.handleClick();
	        };
	        return _this;
	    }
	    Object.defineProperty(MDCFormFieldFoundation, "cssClasses", {
	        get: function () {
	            return cssClasses;
	        },
	        enumerable: false,
	        configurable: true
	    });
	    Object.defineProperty(MDCFormFieldFoundation, "strings", {
	        get: function () {
	            return strings;
	        },
	        enumerable: false,
	        configurable: true
	    });
	    Object.defineProperty(MDCFormFieldFoundation, "defaultAdapter", {
	        get: function () {
	            return {
	                activateInputRipple: function () { return undefined; },
	                deactivateInputRipple: function () { return undefined; },
	                deregisterInteractionHandler: function () { return undefined; },
	                registerInteractionHandler: function () { return undefined; },
	            };
	        },
	        enumerable: false,
	        configurable: true
	    });
	    MDCFormFieldFoundation.prototype.init = function () {
	        this.adapter.registerInteractionHandler('click', this.click);
	    };
	    MDCFormFieldFoundation.prototype.destroy = function () {
	        this.adapter.deregisterInteractionHandler('click', this.click);
	    };
	    MDCFormFieldFoundation.prototype.handleClick = function () {
	        var _this = this;
	        this.adapter.activateInputRipple();
	        requestAnimationFrame(function () {
	            _this.adapter.deactivateInputRipple();
	        });
	    };
	    return MDCFormFieldFoundation;
	}(MDCFoundation));

	/* node_modules/@smui/form-field/dist/FormField.svelte generated by Svelte v4.2.7 */

	const get_label_slot_changes = dirty => ({});
	const get_label_slot_context = ctx => ({});

	function create_fragment$5(ctx) {
		let div;
		let t;
		let label_1;
		let useActions_action;
		let div_class_value;
		let useActions_action_1;
		let current;
		let mounted;
		let dispose;
		const default_slot_template = /*#slots*/ ctx[14].default;
		const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[13], null);
		const label_slot_template = /*#slots*/ ctx[14].label;
		const label_slot = create_slot(label_slot_template, ctx, /*$$scope*/ ctx[13], get_label_slot_context);
		let label_1_levels = [{ for: /*inputId*/ ctx[4] }, prefixFilter(/*$$restProps*/ ctx[11], 'label$')];
		let label_data = {};

		for (let i = 0; i < label_1_levels.length; i += 1) {
			label_data = assign(label_data, label_1_levels[i]);
		}

		let div_levels = [
			{
				class: div_class_value = classMap({
					[/*className*/ ctx[1]]: true,
					'mdc-form-field': true,
					'mdc-form-field--align-end': /*align*/ ctx[2] === 'end',
					'mdc-form-field--nowrap': /*noWrap*/ ctx[3]
				})
			},
			exclude(/*$$restProps*/ ctx[11], ['label$'])
		];

		let div_data = {};

		for (let i = 0; i < div_levels.length; i += 1) {
			div_data = assign(div_data, div_levels[i]);
		}

		return {
			c() {
				div = element("div");
				if (default_slot) default_slot.c();
				t = space();
				label_1 = element("label");
				if (label_slot) label_slot.c();
				set_attributes(label_1, label_data);
				set_attributes(div, div_data);
			},
			m(target, anchor) {
				insert(target, div, anchor);

				if (default_slot) {
					default_slot.m(div, null);
				}

				append(div, t);
				append(div, label_1);

				if (label_slot) {
					label_slot.m(label_1, null);
				}

				/*label_1_binding*/ ctx[15](label_1);
				/*div_binding*/ ctx[16](div);
				current = true;

				if (!mounted) {
					dispose = [
						action_destroyer(useActions_action = useActions.call(null, label_1, /*label$use*/ ctx[5])),
						action_destroyer(useActions_action_1 = useActions.call(null, div, /*use*/ ctx[0])),
						action_destroyer(/*forwardEvents*/ ctx[9].call(null, div)),
						listen$1(div, "SMUIGenericInput:mount", /*handleInputMount*/ ctx[10]),
						listen$1(div, "SMUIGenericInput:unmount", /*SMUIGenericInput_unmount_handler*/ ctx[17])
					];

					mounted = true;
				}
			},
			p(ctx, [dirty]) {
				if (default_slot) {
					if (default_slot.p && (!current || dirty & /*$$scope*/ 8192)) {
						update_slot_base(
							default_slot,
							default_slot_template,
							ctx,
							/*$$scope*/ ctx[13],
							!current
							? get_all_dirty_from_scope(/*$$scope*/ ctx[13])
							: get_slot_changes(default_slot_template, /*$$scope*/ ctx[13], dirty, null),
							null
						);
					}
				}

				if (label_slot) {
					if (label_slot.p && (!current || dirty & /*$$scope*/ 8192)) {
						update_slot_base(
							label_slot,
							label_slot_template,
							ctx,
							/*$$scope*/ ctx[13],
							!current
							? get_all_dirty_from_scope(/*$$scope*/ ctx[13])
							: get_slot_changes(label_slot_template, /*$$scope*/ ctx[13], dirty, get_label_slot_changes),
							get_label_slot_context
						);
					}
				}

				set_attributes(label_1, label_data = get_spread_update(label_1_levels, [
					(!current || dirty & /*inputId*/ 16) && { for: /*inputId*/ ctx[4] },
					dirty & /*$$restProps*/ 2048 && prefixFilter(/*$$restProps*/ ctx[11], 'label$')
				]));

				if (useActions_action && is_function(useActions_action.update) && dirty & /*label$use*/ 32) useActions_action.update.call(null, /*label$use*/ ctx[5]);

				set_attributes(div, div_data = get_spread_update(div_levels, [
					(!current || dirty & /*className, align, noWrap*/ 14 && div_class_value !== (div_class_value = classMap({
						[/*className*/ ctx[1]]: true,
						'mdc-form-field': true,
						'mdc-form-field--align-end': /*align*/ ctx[2] === 'end',
						'mdc-form-field--nowrap': /*noWrap*/ ctx[3]
					}))) && { class: div_class_value },
					dirty & /*$$restProps*/ 2048 && exclude(/*$$restProps*/ ctx[11], ['label$'])
				]));

				if (useActions_action_1 && is_function(useActions_action_1.update) && dirty & /*use*/ 1) useActions_action_1.update.call(null, /*use*/ ctx[0]);
			},
			i(local) {
				if (current) return;
				transition_in(default_slot, local);
				transition_in(label_slot, local);
				current = true;
			},
			o(local) {
				transition_out(default_slot, local);
				transition_out(label_slot, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(div);
				}

				if (default_slot) default_slot.d(detaching);
				if (label_slot) label_slot.d(detaching);
				/*label_1_binding*/ ctx[15](null);
				/*div_binding*/ ctx[16](null);
				mounted = false;
				run_all(dispose);
			}
		};
	}
	let counter = 0;

	function instance_1($$self, $$props, $$invalidate) {
		const omit_props_names = ["use","class","align","noWrap","inputId","label$use","getElement"];
		let $$restProps = compute_rest_props($$props, omit_props_names);
		let { $$slots: slots = {}, $$scope } = $$props;
		const forwardEvents = forwardEventsBuilder(get_current_component());
		let { use = [] } = $$props;
		let { class: className = '' } = $$props;
		let { align = 'start' } = $$props;
		let { noWrap = false } = $$props;
		let { inputId = 'SMUI-form-field-' + counter++ } = $$props;
		let { label$use = [] } = $$props;
		let element;
		let instance;
		let label;
		let input;
		setContext('SMUI:generic:input:props', { id: inputId });

		onMount(() => {
			instance = new MDCFormFieldFoundation({
					activateInputRipple: () => {
						if (input) {
							input.activateRipple();
						}
					},
					deactivateInputRipple: () => {
						if (input) {
							input.deactivateRipple();
						}
					},
					deregisterInteractionHandler: (evtType, handler) => {
						label.removeEventListener(evtType, handler);
					},
					registerInteractionHandler: (evtType, handler) => {
						label.addEventListener(evtType, handler);
					}
				});

			instance.init();

			return () => {
				instance.destroy();
			};
		});

		function handleInputMount(event) {
			$$invalidate(8, input = event.detail);
		}

		function getElement() {
			return element;
		}

		function label_1_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				label = $$value;
				$$invalidate(7, label);
			});
		}

		function div_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				element = $$value;
				$$invalidate(6, element);
			});
		}

		const SMUIGenericInput_unmount_handler = () => $$invalidate(8, input = undefined);

		$$self.$$set = $$new_props => {
			$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
			$$invalidate(11, $$restProps = compute_rest_props($$props, omit_props_names));
			if ('use' in $$new_props) $$invalidate(0, use = $$new_props.use);
			if ('class' in $$new_props) $$invalidate(1, className = $$new_props.class);
			if ('align' in $$new_props) $$invalidate(2, align = $$new_props.align);
			if ('noWrap' in $$new_props) $$invalidate(3, noWrap = $$new_props.noWrap);
			if ('inputId' in $$new_props) $$invalidate(4, inputId = $$new_props.inputId);
			if ('label$use' in $$new_props) $$invalidate(5, label$use = $$new_props.label$use);
			if ('$$scope' in $$new_props) $$invalidate(13, $$scope = $$new_props.$$scope);
		};

		return [
			use,
			className,
			align,
			noWrap,
			inputId,
			label$use,
			element,
			label,
			input,
			forwardEvents,
			handleInputMount,
			$$restProps,
			getElement,
			$$scope,
			slots,
			label_1_binding,
			div_binding,
			SMUIGenericInput_unmount_handler
		];
	}

	class FormField extends SvelteComponent {
		constructor(options) {
			super();

			init(this, options, instance_1, create_fragment$5, safe_not_equal, {
				use: 0,
				class: 1,
				align: 2,
				noWrap: 3,
				inputId: 4,
				label$use: 5,
				getElement: 12
			});
		}

		get getElement() {
			return this.$$.ctx[12];
		}
	}

	/* node_modules/@smui/card/dist/Card.svelte generated by Svelte v4.2.7 */

	function create_fragment$4(ctx) {
		let div;
		let div_class_value;
		let useActions_action;
		let current;
		let mounted;
		let dispose;
		const default_slot_template = /*#slots*/ ctx[9].default;
		const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[8], null);

		let div_levels = [
			{
				class: div_class_value = classMap({
					[/*className*/ ctx[1]]: true,
					'mdc-card': true,
					'mdc-card--outlined': /*variant*/ ctx[2] === 'outlined',
					'smui-card--padded': /*padded*/ ctx[3]
				})
			},
			/*$$restProps*/ ctx[6]
		];

		let div_data = {};

		for (let i = 0; i < div_levels.length; i += 1) {
			div_data = assign(div_data, div_levels[i]);
		}

		return {
			c() {
				div = element("div");
				if (default_slot) default_slot.c();
				set_attributes(div, div_data);
			},
			m(target, anchor) {
				insert(target, div, anchor);

				if (default_slot) {
					default_slot.m(div, null);
				}

				/*div_binding*/ ctx[10](div);
				current = true;

				if (!mounted) {
					dispose = [
						action_destroyer(useActions_action = useActions.call(null, div, /*use*/ ctx[0])),
						action_destroyer(/*forwardEvents*/ ctx[5].call(null, div))
					];

					mounted = true;
				}
			},
			p(ctx, [dirty]) {
				if (default_slot) {
					if (default_slot.p && (!current || dirty & /*$$scope*/ 256)) {
						update_slot_base(
							default_slot,
							default_slot_template,
							ctx,
							/*$$scope*/ ctx[8],
							!current
							? get_all_dirty_from_scope(/*$$scope*/ ctx[8])
							: get_slot_changes(default_slot_template, /*$$scope*/ ctx[8], dirty, null),
							null
						);
					}
				}

				set_attributes(div, div_data = get_spread_update(div_levels, [
					(!current || dirty & /*className, variant, padded*/ 14 && div_class_value !== (div_class_value = classMap({
						[/*className*/ ctx[1]]: true,
						'mdc-card': true,
						'mdc-card--outlined': /*variant*/ ctx[2] === 'outlined',
						'smui-card--padded': /*padded*/ ctx[3]
					}))) && { class: div_class_value },
					dirty & /*$$restProps*/ 64 && /*$$restProps*/ ctx[6]
				]));

				if (useActions_action && is_function(useActions_action.update) && dirty & /*use*/ 1) useActions_action.update.call(null, /*use*/ ctx[0]);
			},
			i(local) {
				if (current) return;
				transition_in(default_slot, local);
				current = true;
			},
			o(local) {
				transition_out(default_slot, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(div);
				}

				if (default_slot) default_slot.d(detaching);
				/*div_binding*/ ctx[10](null);
				mounted = false;
				run_all(dispose);
			}
		};
	}

	function instance$4($$self, $$props, $$invalidate) {
		const omit_props_names = ["use","class","variant","padded","getElement"];
		let $$restProps = compute_rest_props($$props, omit_props_names);
		let { $$slots: slots = {}, $$scope } = $$props;
		const forwardEvents = forwardEventsBuilder(get_current_component());
		let { use = [] } = $$props;
		let { class: className = '' } = $$props;
		let { variant = 'raised' } = $$props;
		let { padded = false } = $$props;
		let element;

		function getElement() {
			return element;
		}

		function div_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				element = $$value;
				$$invalidate(4, element);
			});
		}

		$$self.$$set = $$new_props => {
			$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
			$$invalidate(6, $$restProps = compute_rest_props($$props, omit_props_names));
			if ('use' in $$new_props) $$invalidate(0, use = $$new_props.use);
			if ('class' in $$new_props) $$invalidate(1, className = $$new_props.class);
			if ('variant' in $$new_props) $$invalidate(2, variant = $$new_props.variant);
			if ('padded' in $$new_props) $$invalidate(3, padded = $$new_props.padded);
			if ('$$scope' in $$new_props) $$invalidate(8, $$scope = $$new_props.$$scope);
		};

		return [
			use,
			className,
			variant,
			padded,
			element,
			forwardEvents,
			$$restProps,
			getElement,
			$$scope,
			slots,
			div_binding
		];
	}

	class Card extends SvelteComponent {
		constructor(options) {
			super();

			init(this, options, instance$4, create_fragment$4, safe_not_equal, {
				use: 0,
				class: 1,
				variant: 2,
				padded: 3,
				getElement: 7
			});
		}

		get getElement() {
			return this.$$.ctx[7];
		}
	}

	var Content = classAdderBuilder({
	    class: 'smui-card__content',
	    tag: 'div',
	});

	classAdderBuilder({
	    class: 'mdc-card__media-content',
	    tag: 'div',
	});

	/* node_modules/@smui/card/dist/Actions.svelte generated by Svelte v4.2.7 */

	function create_fragment$3(ctx) {
		let div;
		let div_class_value;
		let useActions_action;
		let current;
		let mounted;
		let dispose;
		const default_slot_template = /*#slots*/ ctx[8].default;
		const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[7], null);

		let div_levels = [
			{
				class: div_class_value = classMap({
					[/*className*/ ctx[1]]: true,
					'mdc-card__actions': true,
					'mdc-card__actions--full-bleed': /*fullBleed*/ ctx[2]
				})
			},
			/*$$restProps*/ ctx[5]
		];

		let div_data = {};

		for (let i = 0; i < div_levels.length; i += 1) {
			div_data = assign(div_data, div_levels[i]);
		}

		return {
			c() {
				div = element("div");
				if (default_slot) default_slot.c();
				set_attributes(div, div_data);
			},
			m(target, anchor) {
				insert(target, div, anchor);

				if (default_slot) {
					default_slot.m(div, null);
				}

				/*div_binding*/ ctx[9](div);
				current = true;

				if (!mounted) {
					dispose = [
						action_destroyer(useActions_action = useActions.call(null, div, /*use*/ ctx[0])),
						action_destroyer(/*forwardEvents*/ ctx[4].call(null, div))
					];

					mounted = true;
				}
			},
			p(ctx, [dirty]) {
				if (default_slot) {
					if (default_slot.p && (!current || dirty & /*$$scope*/ 128)) {
						update_slot_base(
							default_slot,
							default_slot_template,
							ctx,
							/*$$scope*/ ctx[7],
							!current
							? get_all_dirty_from_scope(/*$$scope*/ ctx[7])
							: get_slot_changes(default_slot_template, /*$$scope*/ ctx[7], dirty, null),
							null
						);
					}
				}

				set_attributes(div, div_data = get_spread_update(div_levels, [
					(!current || dirty & /*className, fullBleed*/ 6 && div_class_value !== (div_class_value = classMap({
						[/*className*/ ctx[1]]: true,
						'mdc-card__actions': true,
						'mdc-card__actions--full-bleed': /*fullBleed*/ ctx[2]
					}))) && { class: div_class_value },
					dirty & /*$$restProps*/ 32 && /*$$restProps*/ ctx[5]
				]));

				if (useActions_action && is_function(useActions_action.update) && dirty & /*use*/ 1) useActions_action.update.call(null, /*use*/ ctx[0]);
			},
			i(local) {
				if (current) return;
				transition_in(default_slot, local);
				current = true;
			},
			o(local) {
				transition_out(default_slot, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(div);
				}

				if (default_slot) default_slot.d(detaching);
				/*div_binding*/ ctx[9](null);
				mounted = false;
				run_all(dispose);
			}
		};
	}

	function instance$3($$self, $$props, $$invalidate) {
		const omit_props_names = ["use","class","fullBleed","getElement"];
		let $$restProps = compute_rest_props($$props, omit_props_names);
		let { $$slots: slots = {}, $$scope } = $$props;
		const forwardEvents = forwardEventsBuilder(get_current_component());
		let { use = [] } = $$props;
		let { class: className = '' } = $$props;
		let { fullBleed = false } = $$props;
		let element;
		setContext('SMUI:button:context', 'card:action');
		setContext('SMUI:icon-button:context', 'card:action');

		function getElement() {
			return element;
		}

		function div_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				element = $$value;
				$$invalidate(3, element);
			});
		}

		$$self.$$set = $$new_props => {
			$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
			$$invalidate(5, $$restProps = compute_rest_props($$props, omit_props_names));
			if ('use' in $$new_props) $$invalidate(0, use = $$new_props.use);
			if ('class' in $$new_props) $$invalidate(1, className = $$new_props.class);
			if ('fullBleed' in $$new_props) $$invalidate(2, fullBleed = $$new_props.fullBleed);
			if ('$$scope' in $$new_props) $$invalidate(7, $$scope = $$new_props.$$scope);
		};

		return [
			use,
			className,
			fullBleed,
			element,
			forwardEvents,
			$$restProps,
			getElement,
			$$scope,
			slots,
			div_binding
		];
	}

	class Actions extends SvelteComponent {
		constructor(options) {
			super();

			init(this, options, instance$3, create_fragment$3, safe_not_equal, {
				use: 0,
				class: 1,
				fullBleed: 2,
				getElement: 6
			});
		}

		get getElement() {
			return this.$$.ctx[6];
		}
	}

	classAdderBuilder({
	    class: 'mdc-card__action-buttons',
	    tag: 'div',
	});

	classAdderBuilder({
	    class: 'mdc-card__action-icons',
	    tag: 'div',
	});

	/* node_modules/@smui/button/dist/Button.svelte generated by Svelte v4.2.7 */

	function create_if_block$1(ctx) {
		let div;

		return {
			c() {
				div = element("div");
				attr(div, "class", "mdc-button__touch");
			},
			m(target, anchor) {
				insert(target, div, anchor);
			},
			d(detaching) {
				if (detaching) {
					detach(div);
				}
			}
		};
	}

	// (1:0) <svelte:component   this={component}   {tag}   bind:this={element}   use={[     [       Ripple,       {         ripple,         unbounded: false,         color,         disabled: !!$$restProps.disabled,         addClass,         removeClass,         addStyle,       },     ],     forwardEvents,     ...use,   ]}   class={classMap({     [className]: true,     'mdc-button': true,     'mdc-button--raised': variant === 'raised',     'mdc-button--unelevated': variant === 'unelevated',     'mdc-button--outlined': variant === 'outlined',     'smui-button--color-secondary': color === 'secondary',     'mdc-button--touch': touch,     'mdc-card__action': context === 'card:action',     'mdc-card__action--button': context === 'card:action',     'mdc-dialog__button': context === 'dialog:action',     'mdc-top-app-bar__navigation-icon': context === 'top-app-bar:navigation',     'mdc-top-app-bar__action-item': context === 'top-app-bar:action',     'mdc-snackbar__action': context === 'snackbar:actions',     'mdc-banner__secondary-action': context === 'banner' && secondary,     'mdc-banner__primary-action': context === 'banner' && !secondary,     'mdc-tooltip__action': context === 'tooltip:rich-actions',     ...internalClasses,   })}   style={Object.entries(internalStyles)     .map(([name, value]) => `${name}: ${value};`)     .concat([style])     .join(' ')}   {...actionProp}   {...defaultProp}   {...secondaryProp}   {href}   on:click={handleClick}   {...$$restProps}   >
	function create_default_slot$2(ctx) {
		let div;
		let t;
		let if_block_anchor;
		let current;
		const default_slot_template = /*#slots*/ ctx[28].default;
		const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[30], null);
		let if_block = /*touch*/ ctx[6] && create_if_block$1();

		return {
			c() {
				div = element("div");
				t = space();
				if (default_slot) default_slot.c();
				if (if_block) if_block.c();
				if_block_anchor = empty();
				attr(div, "class", "mdc-button__ripple");
			},
			m(target, anchor) {
				insert(target, div, anchor);
				insert(target, t, anchor);

				if (default_slot) {
					default_slot.m(target, anchor);
				}

				if (if_block) if_block.m(target, anchor);
				insert(target, if_block_anchor, anchor);
				current = true;
			},
			p(ctx, dirty) {
				if (default_slot) {
					if (default_slot.p && (!current || dirty[0] & /*$$scope*/ 1073741824)) {
						update_slot_base(
							default_slot,
							default_slot_template,
							ctx,
							/*$$scope*/ ctx[30],
							!current
							? get_all_dirty_from_scope(/*$$scope*/ ctx[30])
							: get_slot_changes(default_slot_template, /*$$scope*/ ctx[30], dirty, null),
							null
						);
					}
				}

				if (/*touch*/ ctx[6]) {
					if (if_block) ; else {
						if_block = create_if_block$1();
						if_block.c();
						if_block.m(if_block_anchor.parentNode, if_block_anchor);
					}
				} else if (if_block) {
					if_block.d(1);
					if_block = null;
				}
			},
			i(local) {
				if (current) return;
				transition_in(default_slot, local);
				current = true;
			},
			o(local) {
				transition_out(default_slot, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(div);
					detach(t);
					detach(if_block_anchor);
				}

				if (default_slot) default_slot.d(detaching);
				if (if_block) if_block.d(detaching);
			}
		};
	}

	function create_fragment$2(ctx) {
		let switch_instance;
		let switch_instance_anchor;
		let current;

		const switch_instance_spread_levels = [
			{ tag: /*tag*/ ctx[10] },
			{
				use: [
					[
						Ripple,
						{
							ripple: /*ripple*/ ctx[3],
							unbounded: false,
							color: /*color*/ ctx[4],
							disabled: !!/*$$restProps*/ ctx[23].disabled,
							addClass: /*addClass*/ ctx[19],
							removeClass: /*removeClass*/ ctx[20],
							addStyle: /*addStyle*/ ctx[21]
						}
					],
					/*forwardEvents*/ ctx[17],
					.../*use*/ ctx[0]
				]
			},
			{
				class: classMap({
					[/*className*/ ctx[1]]: true,
					'mdc-button': true,
					'mdc-button--raised': /*variant*/ ctx[5] === 'raised',
					'mdc-button--unelevated': /*variant*/ ctx[5] === 'unelevated',
					'mdc-button--outlined': /*variant*/ ctx[5] === 'outlined',
					'smui-button--color-secondary': /*color*/ ctx[4] === 'secondary',
					'mdc-button--touch': /*touch*/ ctx[6],
					'mdc-card__action': /*context*/ ctx[18] === 'card:action',
					'mdc-card__action--button': /*context*/ ctx[18] === 'card:action',
					'mdc-dialog__button': /*context*/ ctx[18] === 'dialog:action',
					'mdc-top-app-bar__navigation-icon': /*context*/ ctx[18] === 'top-app-bar:navigation',
					'mdc-top-app-bar__action-item': /*context*/ ctx[18] === 'top-app-bar:action',
					'mdc-snackbar__action': /*context*/ ctx[18] === 'snackbar:actions',
					'mdc-banner__secondary-action': /*context*/ ctx[18] === 'banner' && /*secondary*/ ctx[8],
					'mdc-banner__primary-action': /*context*/ ctx[18] === 'banner' && !/*secondary*/ ctx[8],
					'mdc-tooltip__action': /*context*/ ctx[18] === 'tooltip:rich-actions',
					.../*internalClasses*/ ctx[12]
				})
			},
			{
				style: Object.entries(/*internalStyles*/ ctx[13]).map(func).concat([/*style*/ ctx[2]]).join(' ')
			},
			/*actionProp*/ ctx[16],
			/*defaultProp*/ ctx[15],
			/*secondaryProp*/ ctx[14],
			{ href: /*href*/ ctx[7] },
			/*$$restProps*/ ctx[23]
		];

		var switch_value = /*component*/ ctx[9];

		function switch_props(ctx, dirty) {
			let switch_instance_props = {
				$$slots: { default: [create_default_slot$2] },
				$$scope: { ctx }
			};

			if (dirty !== undefined && dirty[0] & /*tag, ripple, color, $$restProps, addClass, removeClass, addStyle, forwardEvents, use, className, variant, touch, context, secondary, internalClasses, internalStyles, style, actionProp, defaultProp, secondaryProp, href*/ 12580351) {
				switch_instance_props = get_spread_update(switch_instance_spread_levels, [
					dirty[0] & /*tag*/ 1024 && { tag: /*tag*/ ctx[10] },
					dirty[0] & /*ripple, color, $$restProps, addClass, removeClass, addStyle, forwardEvents, use*/ 12189721 && {
						use: [
							[
								Ripple,
								{
									ripple: /*ripple*/ ctx[3],
									unbounded: false,
									color: /*color*/ ctx[4],
									disabled: !!/*$$restProps*/ ctx[23].disabled,
									addClass: /*addClass*/ ctx[19],
									removeClass: /*removeClass*/ ctx[20],
									addStyle: /*addStyle*/ ctx[21]
								}
							],
							/*forwardEvents*/ ctx[17],
							.../*use*/ ctx[0]
						]
					},
					dirty[0] & /*className, variant, color, touch, context, secondary, internalClasses*/ 266610 && {
						class: classMap({
							[/*className*/ ctx[1]]: true,
							'mdc-button': true,
							'mdc-button--raised': /*variant*/ ctx[5] === 'raised',
							'mdc-button--unelevated': /*variant*/ ctx[5] === 'unelevated',
							'mdc-button--outlined': /*variant*/ ctx[5] === 'outlined',
							'smui-button--color-secondary': /*color*/ ctx[4] === 'secondary',
							'mdc-button--touch': /*touch*/ ctx[6],
							'mdc-card__action': /*context*/ ctx[18] === 'card:action',
							'mdc-card__action--button': /*context*/ ctx[18] === 'card:action',
							'mdc-dialog__button': /*context*/ ctx[18] === 'dialog:action',
							'mdc-top-app-bar__navigation-icon': /*context*/ ctx[18] === 'top-app-bar:navigation',
							'mdc-top-app-bar__action-item': /*context*/ ctx[18] === 'top-app-bar:action',
							'mdc-snackbar__action': /*context*/ ctx[18] === 'snackbar:actions',
							'mdc-banner__secondary-action': /*context*/ ctx[18] === 'banner' && /*secondary*/ ctx[8],
							'mdc-banner__primary-action': /*context*/ ctx[18] === 'banner' && !/*secondary*/ ctx[8],
							'mdc-tooltip__action': /*context*/ ctx[18] === 'tooltip:rich-actions',
							.../*internalClasses*/ ctx[12]
						})
					},
					dirty[0] & /*internalStyles, style*/ 8196 && {
						style: Object.entries(/*internalStyles*/ ctx[13]).map(func).concat([/*style*/ ctx[2]]).join(' ')
					},
					dirty[0] & /*actionProp*/ 65536 && get_spread_object(/*actionProp*/ ctx[16]),
					dirty[0] & /*defaultProp*/ 32768 && get_spread_object(/*defaultProp*/ ctx[15]),
					dirty[0] & /*secondaryProp*/ 16384 && get_spread_object(/*secondaryProp*/ ctx[14]),
					dirty[0] & /*href*/ 128 && { href: /*href*/ ctx[7] },
					dirty[0] & /*$$restProps*/ 8388608 && get_spread_object(/*$$restProps*/ ctx[23])
				]);
			} else {
				for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
					switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
				}
			}

			return { props: switch_instance_props };
		}

		if (switch_value) {
			switch_instance = construct_svelte_component(switch_value, switch_props(ctx));
			/*switch_instance_binding*/ ctx[29](switch_instance);
			switch_instance.$on("click", /*handleClick*/ ctx[22]);
		}

		return {
			c() {
				if (switch_instance) create_component(switch_instance.$$.fragment);
				switch_instance_anchor = empty();
			},
			m(target, anchor) {
				if (switch_instance) mount_component(switch_instance, target, anchor);
				insert(target, switch_instance_anchor, anchor);
				current = true;
			},
			p(ctx, dirty) {
				if (dirty[0] & /*component*/ 512 && switch_value !== (switch_value = /*component*/ ctx[9])) {
					if (switch_instance) {
						group_outros();
						const old_component = switch_instance;

						transition_out(old_component.$$.fragment, 1, 0, () => {
							destroy_component(old_component, 1);
						});

						check_outros();
					}

					if (switch_value) {
						switch_instance = construct_svelte_component(switch_value, switch_props(ctx, dirty));
						/*switch_instance_binding*/ ctx[29](switch_instance);
						switch_instance.$on("click", /*handleClick*/ ctx[22]);
						create_component(switch_instance.$$.fragment);
						transition_in(switch_instance.$$.fragment, 1);
						mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
					} else {
						switch_instance = null;
					}
				} else if (switch_value) {
					const switch_instance_changes = (dirty[0] & /*tag, ripple, color, $$restProps, addClass, removeClass, addStyle, forwardEvents, use, className, variant, touch, context, secondary, internalClasses, internalStyles, style, actionProp, defaultProp, secondaryProp, href*/ 12580351)
					? get_spread_update(switch_instance_spread_levels, [
							dirty[0] & /*tag*/ 1024 && { tag: /*tag*/ ctx[10] },
							dirty[0] & /*ripple, color, $$restProps, addClass, removeClass, addStyle, forwardEvents, use*/ 12189721 && {
								use: [
									[
										Ripple,
										{
											ripple: /*ripple*/ ctx[3],
											unbounded: false,
											color: /*color*/ ctx[4],
											disabled: !!/*$$restProps*/ ctx[23].disabled,
											addClass: /*addClass*/ ctx[19],
											removeClass: /*removeClass*/ ctx[20],
											addStyle: /*addStyle*/ ctx[21]
										}
									],
									/*forwardEvents*/ ctx[17],
									.../*use*/ ctx[0]
								]
							},
							dirty[0] & /*className, variant, color, touch, context, secondary, internalClasses*/ 266610 && {
								class: classMap({
									[/*className*/ ctx[1]]: true,
									'mdc-button': true,
									'mdc-button--raised': /*variant*/ ctx[5] === 'raised',
									'mdc-button--unelevated': /*variant*/ ctx[5] === 'unelevated',
									'mdc-button--outlined': /*variant*/ ctx[5] === 'outlined',
									'smui-button--color-secondary': /*color*/ ctx[4] === 'secondary',
									'mdc-button--touch': /*touch*/ ctx[6],
									'mdc-card__action': /*context*/ ctx[18] === 'card:action',
									'mdc-card__action--button': /*context*/ ctx[18] === 'card:action',
									'mdc-dialog__button': /*context*/ ctx[18] === 'dialog:action',
									'mdc-top-app-bar__navigation-icon': /*context*/ ctx[18] === 'top-app-bar:navigation',
									'mdc-top-app-bar__action-item': /*context*/ ctx[18] === 'top-app-bar:action',
									'mdc-snackbar__action': /*context*/ ctx[18] === 'snackbar:actions',
									'mdc-banner__secondary-action': /*context*/ ctx[18] === 'banner' && /*secondary*/ ctx[8],
									'mdc-banner__primary-action': /*context*/ ctx[18] === 'banner' && !/*secondary*/ ctx[8],
									'mdc-tooltip__action': /*context*/ ctx[18] === 'tooltip:rich-actions',
									.../*internalClasses*/ ctx[12]
								})
							},
							dirty[0] & /*internalStyles, style*/ 8196 && {
								style: Object.entries(/*internalStyles*/ ctx[13]).map(func).concat([/*style*/ ctx[2]]).join(' ')
							},
							dirty[0] & /*actionProp*/ 65536 && get_spread_object(/*actionProp*/ ctx[16]),
							dirty[0] & /*defaultProp*/ 32768 && get_spread_object(/*defaultProp*/ ctx[15]),
							dirty[0] & /*secondaryProp*/ 16384 && get_spread_object(/*secondaryProp*/ ctx[14]),
							dirty[0] & /*href*/ 128 && { href: /*href*/ ctx[7] },
							dirty[0] & /*$$restProps*/ 8388608 && get_spread_object(/*$$restProps*/ ctx[23])
						])
					: {};

					if (dirty[0] & /*$$scope, touch*/ 1073741888) {
						switch_instance_changes.$$scope = { dirty, ctx };
					}

					switch_instance.$set(switch_instance_changes);
				}
			},
			i(local) {
				if (current) return;
				if (switch_instance) transition_in(switch_instance.$$.fragment, local);
				current = true;
			},
			o(local) {
				if (switch_instance) transition_out(switch_instance.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(switch_instance_anchor);
				}

				/*switch_instance_binding*/ ctx[29](null);
				if (switch_instance) destroy_component(switch_instance, detaching);
			}
		};
	}

	const func = ([name, value]) => `${name}: ${value};`;

	function instance$2($$self, $$props, $$invalidate) {
		let actionProp;
		let defaultProp;
		let secondaryProp;

		const omit_props_names = [
			"use","class","style","ripple","color","variant","touch","href","action","defaultAction","secondary","component","tag","getElement"
		];

		let $$restProps = compute_rest_props($$props, omit_props_names);
		let { $$slots: slots = {}, $$scope } = $$props;
		const forwardEvents = forwardEventsBuilder(get_current_component());
		let { use = [] } = $$props;
		let { class: className = '' } = $$props;
		let { style = '' } = $$props;
		let { ripple = true } = $$props;
		let { color = 'primary' } = $$props;
		let { variant = 'text' } = $$props;
		let { touch = false } = $$props;
		let { href = undefined } = $$props;
		let { action = 'close' } = $$props;
		let { defaultAction = false } = $$props;
		let { secondary = false } = $$props;
		let element;
		let internalClasses = {};
		let internalStyles = {};
		let context = getContext('SMUI:button:context');
		let { component = SmuiElement } = $$props;

		let { tag = component === SmuiElement
		? href == null ? 'button' : 'a'
		: undefined } = $$props;

		let previousDisabled = $$restProps.disabled;
		setContext('SMUI:label:context', 'button');
		setContext('SMUI:icon:context', 'button');

		function addClass(className) {
			if (!internalClasses[className]) {
				$$invalidate(12, internalClasses[className] = true, internalClasses);
			}
		}

		function removeClass(className) {
			if (!(className in internalClasses) || internalClasses[className]) {
				$$invalidate(12, internalClasses[className] = false, internalClasses);
			}
		}

		function addStyle(name, value) {
			if (internalStyles[name] != value) {
				if (value === '' || value == null) {
					delete internalStyles[name];
					$$invalidate(13, internalStyles);
				} else {
					$$invalidate(13, internalStyles[name] = value, internalStyles);
				}
			}
		}

		function handleClick() {
			if (context === 'banner') {
				dispatch(getElement(), secondary
				? 'SMUIBannerButton:secondaryActionClick'
				: 'SMUIBannerButton:primaryActionClick');
			}
		}

		function getElement() {
			return element.getElement();
		}

		function switch_instance_binding($$value) {
			binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				element = $$value;
				$$invalidate(11, element);
			});
		}

		$$self.$$set = $$new_props => {
			$$invalidate(31, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
			$$invalidate(23, $$restProps = compute_rest_props($$props, omit_props_names));
			if ('use' in $$new_props) $$invalidate(0, use = $$new_props.use);
			if ('class' in $$new_props) $$invalidate(1, className = $$new_props.class);
			if ('style' in $$new_props) $$invalidate(2, style = $$new_props.style);
			if ('ripple' in $$new_props) $$invalidate(3, ripple = $$new_props.ripple);
			if ('color' in $$new_props) $$invalidate(4, color = $$new_props.color);
			if ('variant' in $$new_props) $$invalidate(5, variant = $$new_props.variant);
			if ('touch' in $$new_props) $$invalidate(6, touch = $$new_props.touch);
			if ('href' in $$new_props) $$invalidate(7, href = $$new_props.href);
			if ('action' in $$new_props) $$invalidate(24, action = $$new_props.action);
			if ('defaultAction' in $$new_props) $$invalidate(25, defaultAction = $$new_props.defaultAction);
			if ('secondary' in $$new_props) $$invalidate(8, secondary = $$new_props.secondary);
			if ('component' in $$new_props) $$invalidate(9, component = $$new_props.component);
			if ('tag' in $$new_props) $$invalidate(10, tag = $$new_props.tag);
			if ('$$scope' in $$new_props) $$invalidate(30, $$scope = $$new_props.$$scope);
		};

		$$self.$$.update = () => {
			$$invalidate(16, actionProp = context === 'dialog:action' && action != null
			? { 'data-mdc-dialog-action': action }
			: { action: $$props.action });

			$$invalidate(15, defaultProp = context === 'dialog:action' && defaultAction
			? { 'data-mdc-dialog-button-default': '' }
			: { default: $$props.default });

			$$invalidate(14, secondaryProp = context === 'banner'
			? {}
			: { secondary: $$props.secondary });

			if (previousDisabled !== $$restProps.disabled) {
				const el = getElement();

				if ('blur' in el) {
					el.blur();
				}

				$$invalidate(27, previousDisabled = $$restProps.disabled);
			}
		};

		$$props = exclude_internal_props($$props);

		return [
			use,
			className,
			style,
			ripple,
			color,
			variant,
			touch,
			href,
			secondary,
			component,
			tag,
			element,
			internalClasses,
			internalStyles,
			secondaryProp,
			defaultProp,
			actionProp,
			forwardEvents,
			context,
			addClass,
			removeClass,
			addStyle,
			handleClick,
			$$restProps,
			action,
			defaultAction,
			getElement,
			previousDisabled,
			slots,
			switch_instance_binding,
			$$scope
		];
	}

	class Button extends SvelteComponent {
		constructor(options) {
			super();

			init(
				this,
				options,
				instance$2,
				create_fragment$2,
				safe_not_equal,
				{
					use: 0,
					class: 1,
					style: 2,
					ripple: 3,
					color: 4,
					variant: 5,
					touch: 6,
					href: 7,
					action: 24,
					defaultAction: 25,
					secondary: 8,
					component: 9,
					tag: 10,
					getElement: 26
				},
				null,
				[-1, -1]
			);
		}

		get getElement() {
			return this.$$.ctx[26];
		}
	}

	/* src/components/Card.svelte generated by Svelte v4.2.7 */

	function create_default_slot_9$1(ctx) {
		let t_value = /*chip*/ ctx[8] + "";
		let t;

		return {
			c() {
				t = text(t_value);
			},
			m(target, anchor) {
				insert(target, t, anchor);
			},
			p(ctx, dirty) {
				if (dirty & /*chip*/ 256 && t_value !== (t_value = /*chip*/ ctx[8] + "")) set_data(t, t_value);
			},
			d(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	// (31:10) <Chip>
	function create_default_slot_8$1(ctx) {
		let text_1;
		let current;

		text_1 = new Text({
				props: {
					$$slots: { default: [create_default_slot_9$1] },
					$$scope: { ctx }
				}
			});

		return {
			c() {
				create_component(text_1.$$.fragment);
			},
			m(target, anchor) {
				mount_component(text_1, target, anchor);
				current = true;
			},
			p(ctx, dirty) {
				const text_1_changes = {};

				if (dirty & /*$$scope, chip*/ 768) {
					text_1_changes.$$scope = { dirty, ctx };
				}

				text_1.$set(text_1_changes);
			},
			i(local) {
				if (current) return;
				transition_in(text_1.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(text_1.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(text_1, detaching);
			}
		};
	}

	// (28:8) <Set           chips={categories.length > 0 ? [...categories] : ['regular']}           let:chip>
	function create_default_slot_7$1(ctx) {
		let chip;
		let current;

		chip = new Chip({
				props: {
					$$slots: { default: [create_default_slot_8$1] },
					$$scope: { ctx }
				}
			});

		return {
			c() {
				create_component(chip.$$.fragment);
			},
			m(target, anchor) {
				mount_component(chip, target, anchor);
				current = true;
			},
			p(ctx, dirty) {
				const chip_changes = {};

				if (dirty & /*$$scope, chip*/ 768) {
					chip_changes.$$scope = { dirty, ctx };
				}

				chip.$set(chip_changes);
			},
			i(local) {
				if (current) return;
				transition_in(chip.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(chip.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(chip, detaching);
			}
		};
	}

	// (26:4) <Content>
	function create_default_slot_6$1(ctx) {
		let div0;
		let set;
		let t0;
		let div1;
		let t1;
		let current;

		set = new Set_1({
				props: {
					chips: /*categories*/ ctx[0].length > 0
					? [.../*categories*/ ctx[0]]
					: ['regular'],
					$$slots: {
						default: [
							create_default_slot_7$1,
							({ chip }) => ({ 8: chip }),
							({ chip }) => chip ? 256 : 0
						]
					},
					$$scope: { ctx }
				}
			});

		return {
			c() {
				div0 = element("div");
				create_component(set.$$.fragment);
				t0 = space();
				div1 = element("div");
				t1 = text(/*joke*/ ctx[1]);
				attr(div1, "class", "mdc-typography--body2");
			},
			m(target, anchor) {
				insert(target, div0, anchor);
				mount_component(set, div0, null);
				insert(target, t0, anchor);
				insert(target, div1, anchor);
				append(div1, t1);
				current = true;
			},
			p(ctx, dirty) {
				const set_changes = {};

				if (dirty & /*categories*/ 1) set_changes.chips = /*categories*/ ctx[0].length > 0
				? [.../*categories*/ ctx[0]]
				: ['regular'];

				if (dirty & /*$$scope, chip*/ 768) {
					set_changes.$$scope = { dirty, ctx };
				}

				set.$set(set_changes);
				if (!current || dirty & /*joke*/ 2) set_data(t1, /*joke*/ ctx[1]);
			},
			i(local) {
				if (current) return;
				transition_in(set.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(set.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(div0);
					detach(t0);
					detach(div1);
				}

				destroy_component(set);
			}
		};
	}

	// (41:8) <Label>
	function create_default_slot_5$1(ctx) {
		let t;

		return {
			c() {
				t = text("Like");
			},
			m(target, anchor) {
				insert(target, t, anchor);
			},
			d(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	// (40:6) <Button variant="raised" on:click={() => likeJoke(id)}>
	function create_default_slot_4$1(ctx) {
		let label;
		let current;

		label = new CommonLabel({
				props: {
					$$slots: { default: [create_default_slot_5$1] },
					$$scope: { ctx }
				}
			});

		return {
			c() {
				create_component(label.$$.fragment);
			},
			m(target, anchor) {
				mount_component(label, target, anchor);
				current = true;
			},
			p(ctx, dirty) {
				const label_changes = {};

				if (dirty & /*$$scope*/ 512) {
					label_changes.$$scope = { dirty, ctx };
				}

				label.$set(label_changes);
			},
			i(local) {
				if (current) return;
				transition_in(label.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(label.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(label, detaching);
			}
		};
	}

	// (47:8) <Label>
	function create_default_slot_3$1(ctx) {
		let t;

		return {
			c() {
				t = text("Dsilike");
			},
			m(target, anchor) {
				insert(target, t, anchor);
			},
			d(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	// (43:6) <Button         variant="raised"         color="secondary"         on:click={() => dislikeJoke(id)}>
	function create_default_slot_2$1(ctx) {
		let label;
		let current;

		label = new CommonLabel({
				props: {
					$$slots: { default: [create_default_slot_3$1] },
					$$scope: { ctx }
				}
			});

		return {
			c() {
				create_component(label.$$.fragment);
			},
			m(target, anchor) {
				mount_component(label, target, anchor);
				current = true;
			},
			p(ctx, dirty) {
				const label_changes = {};

				if (dirty & /*$$scope*/ 512) {
					label_changes.$$scope = { dirty, ctx };
				}

				label.$set(label_changes);
			},
			i(local) {
				if (current) return;
				transition_in(label.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(label.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(label, detaching);
			}
		};
	}

	// (39:4) <Actions>
	function create_default_slot_1$1(ctx) {
		let button0;
		let t;
		let button1;
		let current;

		button0 = new Button({
				props: {
					variant: "raised",
					$$slots: { default: [create_default_slot_4$1] },
					$$scope: { ctx }
				}
			});

		button0.$on("click", /*click_handler*/ ctx[6]);

		button1 = new Button({
				props: {
					variant: "raised",
					color: "secondary",
					$$slots: { default: [create_default_slot_2$1] },
					$$scope: { ctx }
				}
			});

		button1.$on("click", /*click_handler_1*/ ctx[7]);

		return {
			c() {
				create_component(button0.$$.fragment);
				t = space();
				create_component(button1.$$.fragment);
			},
			m(target, anchor) {
				mount_component(button0, target, anchor);
				insert(target, t, anchor);
				mount_component(button1, target, anchor);
				current = true;
			},
			p(ctx, dirty) {
				const button0_changes = {};

				if (dirty & /*$$scope*/ 512) {
					button0_changes.$$scope = { dirty, ctx };
				}

				button0.$set(button0_changes);
				const button1_changes = {};

				if (dirty & /*$$scope*/ 512) {
					button1_changes.$$scope = { dirty, ctx };
				}

				button1.$set(button1_changes);
			},
			i(local) {
				if (current) return;
				transition_in(button0.$$.fragment, local);
				transition_in(button1.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(button0.$$.fragment, local);
				transition_out(button1.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(t);
				}

				destroy_component(button0, detaching);
				destroy_component(button1, detaching);
			}
		};
	}

	// (25:2) <Card id={`joke-${i}`}>
	function create_default_slot$1(ctx) {
		let content;
		let t;
		let actions;
		let current;

		content = new Content({
				props: {
					$$slots: { default: [create_default_slot_6$1] },
					$$scope: { ctx }
				}
			});

		actions = new Actions({
				props: {
					$$slots: { default: [create_default_slot_1$1] },
					$$scope: { ctx }
				}
			});

		return {
			c() {
				create_component(content.$$.fragment);
				t = space();
				create_component(actions.$$.fragment);
			},
			m(target, anchor) {
				mount_component(content, target, anchor);
				insert(target, t, anchor);
				mount_component(actions, target, anchor);
				current = true;
			},
			p(ctx, dirty) {
				const content_changes = {};

				if (dirty & /*$$scope, joke, categories*/ 515) {
					content_changes.$$scope = { dirty, ctx };
				}

				content.$set(content_changes);
				const actions_changes = {};

				if (dirty & /*$$scope, dislikeJoke, id, likeJoke*/ 540) {
					actions_changes.$$scope = { dirty, ctx };
				}

				actions.$set(actions_changes);
			},
			i(local) {
				if (current) return;
				transition_in(content.$$.fragment, local);
				transition_in(actions.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(content.$$.fragment, local);
				transition_out(actions.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(t);
				}

				destroy_component(content, detaching);
				destroy_component(actions, detaching);
			}
		};
	}

	function create_fragment$1(ctx) {
		let div;
		let card;
		let current;

		card = new Card({
				props: {
					id: `joke-${/*i*/ ctx[5]}`,
					$$slots: { default: [create_default_slot$1] },
					$$scope: { ctx }
				}
			});

		return {
			c() {
				div = element("div");
				create_component(card.$$.fragment);
				attr(div, "class", "card-container svelte-czbyzr");
			},
			m(target, anchor) {
				insert(target, div, anchor);
				mount_component(card, div, null);
				current = true;
			},
			p(ctx, [dirty]) {
				const card_changes = {};
				if (dirty & /*i*/ 32) card_changes.id = `joke-${/*i*/ ctx[5]}`;

				if (dirty & /*$$scope, dislikeJoke, id, likeJoke, joke, categories*/ 543) {
					card_changes.$$scope = { dirty, ctx };
				}

				card.$set(card_changes);
			},
			i(local) {
				if (current) return;
				transition_in(card.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(card.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(div);
				}

				destroy_component(card);
			}
		};
	}

	function instance$1($$self, $$props, $$invalidate) {
		let { categories } = $$props;
		let { joke } = $$props;
		let { id } = $$props;
		let { likeJoke } = $$props;
		let { dislikeJoke } = $$props;
		let { i } = $$props;
		const click_handler = () => likeJoke(id);
		const click_handler_1 = () => dislikeJoke(id);

		$$self.$$set = $$props => {
			if ('categories' in $$props) $$invalidate(0, categories = $$props.categories);
			if ('joke' in $$props) $$invalidate(1, joke = $$props.joke);
			if ('id' in $$props) $$invalidate(2, id = $$props.id);
			if ('likeJoke' in $$props) $$invalidate(3, likeJoke = $$props.likeJoke);
			if ('dislikeJoke' in $$props) $$invalidate(4, dislikeJoke = $$props.dislikeJoke);
			if ('i' in $$props) $$invalidate(5, i = $$props.i);
		};

		return [categories, joke, id, likeJoke, dislikeJoke, i, click_handler, click_handler_1];
	}

	class Card_1 extends SvelteComponent {
		constructor(options) {
			super();

			init(this, options, instance$1, create_fragment$1, safe_not_equal, {
				categories: 0,
				joke: 1,
				id: 2,
				likeJoke: 3,
				dislikeJoke: 4,
				i: 5
			});
		}
	}

	/* src/App.svelte generated by Svelte v4.2.7 */

	function get_each_context_3(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[15] = list[i];
		child_ctx[17] = i;
		return child_ctx;
	}

	function get_each_context_4(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[18] = list[i];
		return child_ctx;
	}

	function get_each_context_5(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[21] = list[i];
		return child_ctx;
	}

	function get_each_context(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[15] = list[i];
		child_ctx[17] = i;
		return child_ctx;
	}

	function get_each_context_1(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[18] = list[i];
		return child_ctx;
	}

	function get_each_context_2(ctx, list, i) {
		const child_ctx = ctx.slice();
		child_ctx[21] = list[i];
		return child_ctx;
	}

	// (187:2) {:catch error}
	function create_catch_block(ctx) {
		let p;
		let t_value = /*error*/ ctx[30].message + "";
		let t;

		return {
			c() {
				p = element("p");
				t = text(t_value);
			},
			m(target, anchor) {
				insert(target, p, anchor);
				append(p, t);
			},
			p(ctx, dirty) {
				if (dirty[0] & /*promise*/ 1 && t_value !== (t_value = /*error*/ ctx[30].message + "")) set_data(t, t_value);
			},
			i: noop,
			o: noop,
			d(detaching) {
				if (detaching) {
					detach(p);
				}
			}
		};
	}

	// (119:2) {:then}
	function create_then_block(ctx) {
		let if_block_anchor;
		let current;
		let if_block = /*jokesToShow*/ ctx[1] && create_if_block(ctx);

		return {
			c() {
				if (if_block) if_block.c();
				if_block_anchor = empty();
			},
			m(target, anchor) {
				if (if_block) if_block.m(target, anchor);
				insert(target, if_block_anchor, anchor);
				current = true;
			},
			p(ctx, dirty) {
				if (/*jokesToShow*/ ctx[1]) {
					if (if_block) {
						if_block.p(ctx, dirty);

						if (dirty[0] & /*jokesToShow*/ 2) {
							transition_in(if_block, 1);
						}
					} else {
						if_block = create_if_block(ctx);
						if_block.c();
						transition_in(if_block, 1);
						if_block.m(if_block_anchor.parentNode, if_block_anchor);
					}
				} else if (if_block) {
					group_outros();

					transition_out(if_block, 1, 1, () => {
						if_block = null;
					});

					check_outros();
				}
			},
			i(local) {
				if (current) return;
				transition_in(if_block);
				current = true;
			},
			o(local) {
				transition_out(if_block);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(if_block_anchor);
				}

				if (if_block) if_block.d(detaching);
			}
		};
	}

	// (120:4) {#if jokesToShow}
	function create_if_block(ctx) {
		let div;
		let topappbar;
		let t;
		let current_block_type_index;
		let if_block;
		let if_block_anchor;
		let current;

		topappbar = new TopAppBar({
				props: {
					variant: "static",
					dense: true,
					style: "margin-bottom:20px",
					$$slots: { default: [create_default_slot_2] },
					$$scope: { ctx }
				}
			});

		const if_block_creators = [create_if_block_1, create_else_block_1];
		const if_blocks = [];

		function select_block_type(ctx, dirty) {
			if (/*active*/ ctx[4] === 'Home') return 0;
			return 1;
		}

		current_block_type_index = select_block_type(ctx);
		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

		return {
			c() {
				div = element("div");
				create_component(topappbar.$$.fragment);
				t = space();
				if_block.c();
				if_block_anchor = empty();
				attr(div, "class", "top-app-bar-container flexor");
			},
			m(target, anchor) {
				insert(target, div, anchor);
				mount_component(topappbar, div, null);
				insert(target, t, anchor);
				if_blocks[current_block_type_index].m(target, anchor);
				insert(target, if_block_anchor, anchor);
				current = true;
			},
			p(ctx, dirty) {
				const topappbar_changes = {};

				if (dirty[0] & /*active, likedJokes*/ 20 | dirty[1] & /*$$scope*/ 1) {
					topappbar_changes.$$scope = { dirty, ctx };
				}

				topappbar.$set(topappbar_changes);
				let previous_block_index = current_block_type_index;
				current_block_type_index = select_block_type(ctx);

				if (current_block_type_index === previous_block_index) {
					if_blocks[current_block_type_index].p(ctx, dirty);
				} else {
					group_outros();

					transition_out(if_blocks[previous_block_index], 1, 1, () => {
						if_blocks[previous_block_index] = null;
					});

					check_outros();
					if_block = if_blocks[current_block_type_index];

					if (!if_block) {
						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
						if_block.c();
					} else {
						if_block.p(ctx, dirty);
					}

					transition_in(if_block, 1);
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			},
			i(local) {
				if (current) return;
				transition_in(topappbar.$$.fragment, local);
				transition_in(if_block);
				current = true;
			},
			o(local) {
				transition_out(topappbar.$$.fragment, local);
				transition_out(if_block);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(div);
					detach(t);
					detach(if_block_anchor);
				}

				destroy_component(topappbar);
				if_blocks[current_block_type_index].d(detaching);
			}
		};
	}

	// (131:18) {#if tab === 'Likes' && likedJokes.length > 0}
	function create_if_block_8(ctx) {
		let chip;
		let current;

		chip = new Chip({
				props: {
					style: "background-color:lightblue",
					$$slots: { default: [create_default_slot_8] },
					$$scope: { ctx }
				}
			});

		return {
			c() {
				create_component(chip.$$.fragment);
			},
			m(target, anchor) {
				mount_component(chip, target, anchor);
				current = true;
			},
			p(ctx, dirty) {
				const chip_changes = {};

				if (dirty[0] & /*likedJokes*/ 4 | dirty[1] & /*$$scope*/ 1) {
					chip_changes.$$scope = { dirty, ctx };
				}

				chip.$set(chip_changes);
			},
			i(local) {
				if (current) return;
				transition_in(chip.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(chip.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(chip, detaching);
			}
		};
	}

	// (133:22) <Text>
	function create_default_slot_9(ctx) {
		let t_value = /*likedJokes*/ ctx[2].length + "";
		let t;

		return {
			c() {
				t = text(t_value);
			},
			m(target, anchor) {
				insert(target, t, anchor);
			},
			p(ctx, dirty) {
				if (dirty[0] & /*likedJokes*/ 4 && t_value !== (t_value = /*likedJokes*/ ctx[2].length + "")) set_data(t, t_value);
			},
			d(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	// (132:20) <Chip style="background-color:lightblue">
	function create_default_slot_8(ctx) {
		let text_1;
		let current;

		text_1 = new Text({
				props: {
					$$slots: { default: [create_default_slot_9] },
					$$scope: { ctx }
				}
			});

		return {
			c() {
				create_component(text_1.$$.fragment);
			},
			m(target, anchor) {
				mount_component(text_1, target, anchor);
				current = true;
			},
			p(ctx, dirty) {
				const text_1_changes = {};

				if (dirty[0] & /*likedJokes*/ 4 | dirty[1] & /*$$scope*/ 1) {
					text_1_changes.$$scope = { dirty, ctx };
				}

				text_1.$set(text_1_changes);
			},
			i(local) {
				if (current) return;
				transition_in(text_1.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(text_1.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(text_1, detaching);
			}
		};
	}

	// (136:18) <Title>
	function create_default_slot_7(ctx) {
		let t_value = /*tab*/ ctx[29] + "";
		let t;

		return {
			c() {
				t = text(t_value);
			},
			m(target, anchor) {
				insert(target, t, anchor);
			},
			p(ctx, dirty) {
				if (dirty[0] & /*tab*/ 536870912 && t_value !== (t_value = /*tab*/ ctx[29] + "")) set_data(t, t_value);
			},
			d(detaching) {
				if (detaching) {
					detach(t);
				}
			}
		};
	}

	// (130:16) <Tab {tab}>
	function create_default_slot_6(ctx) {
		let t;
		let title;
		let current;
		let if_block = /*tab*/ ctx[29] === 'Likes' && /*likedJokes*/ ctx[2].length > 0 && create_if_block_8(ctx);

		title = new Title({
				props: {
					$$slots: { default: [create_default_slot_7] },
					$$scope: { ctx }
				}
			});

		return {
			c() {
				if (if_block) if_block.c();
				t = space();
				create_component(title.$$.fragment);
			},
			m(target, anchor) {
				if (if_block) if_block.m(target, anchor);
				insert(target, t, anchor);
				mount_component(title, target, anchor);
				current = true;
			},
			p(ctx, dirty) {
				if (/*tab*/ ctx[29] === 'Likes' && /*likedJokes*/ ctx[2].length > 0) {
					if (if_block) {
						if_block.p(ctx, dirty);

						if (dirty[0] & /*tab, likedJokes*/ 536870916) {
							transition_in(if_block, 1);
						}
					} else {
						if_block = create_if_block_8(ctx);
						if_block.c();
						transition_in(if_block, 1);
						if_block.m(t.parentNode, t);
					}
				} else if (if_block) {
					group_outros();

					transition_out(if_block, 1, 1, () => {
						if_block = null;
					});

					check_outros();
				}

				const title_changes = {};

				if (dirty[0] & /*tab*/ 536870912 | dirty[1] & /*$$scope*/ 1) {
					title_changes.$$scope = { dirty, ctx };
				}

				title.$set(title_changes);
			},
			i(local) {
				if (current) return;
				transition_in(if_block);
				transition_in(title.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(if_block);
				transition_out(title.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(t);
				}

				if (if_block) if_block.d(detaching);
				destroy_component(title, detaching);
			}
		};
	}

	// (129:14) <Section>
	function create_default_slot_5(ctx) {
		let tab;
		let current;

		tab = new Tab({
				props: {
					tab: /*tab*/ ctx[29],
					$$slots: { default: [create_default_slot_6] },
					$$scope: { ctx }
				}
			});

		return {
			c() {
				create_component(tab.$$.fragment);
			},
			m(target, anchor) {
				mount_component(tab, target, anchor);
				current = true;
			},
			p(ctx, dirty) {
				const tab_changes = {};
				if (dirty[0] & /*tab*/ 536870912) tab_changes.tab = /*tab*/ ctx[29];

				if (dirty[0] & /*tab, likedJokes*/ 536870916 | dirty[1] & /*$$scope*/ 1) {
					tab_changes.$$scope = { dirty, ctx };
				}

				tab.$set(tab_changes);
			},
			i(local) {
				if (current) return;
				transition_in(tab.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(tab.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(tab, detaching);
			}
		};
	}

	// (124:12) <TabBar               tabs={['Home', 'Likes']}               let:tab               bind:active               style="margin-bottom:20px">
	function create_default_slot_4(ctx) {
		let section;
		let current;

		section = new Section({
				props: {
					$$slots: { default: [create_default_slot_5] },
					$$scope: { ctx }
				}
			});

		return {
			c() {
				create_component(section.$$.fragment);
			},
			m(target, anchor) {
				mount_component(section, target, anchor);
				current = true;
			},
			p(ctx, dirty) {
				const section_changes = {};

				if (dirty[0] & /*tab, likedJokes*/ 536870916 | dirty[1] & /*$$scope*/ 1) {
					section_changes.$$scope = { dirty, ctx };
				}

				section.$set(section_changes);
			},
			i(local) {
				if (current) return;
				transition_in(section.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(section.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(section, detaching);
			}
		};
	}

	// (123:10) <Row>
	function create_default_slot_3(ctx) {
		let tabbar;
		let updating_active;
		let current;

		function tabbar_active_binding(value) {
			/*tabbar_active_binding*/ ctx[9](value);
		}

		let tabbar_props = {
			tabs: ['Home', 'Likes'],
			style: "margin-bottom:20px",
			$$slots: {
				default: [
					create_default_slot_4,
					({ tab }) => ({ 29: tab }),
					({ tab }) => [tab ? 536870912 : 0]
				]
			},
			$$scope: { ctx }
		};

		if (/*active*/ ctx[4] !== void 0) {
			tabbar_props.active = /*active*/ ctx[4];
		}

		tabbar = new TabBar({ props: tabbar_props });
		binding_callbacks.push(() => bind(tabbar, 'active', tabbar_active_binding));

		return {
			c() {
				create_component(tabbar.$$.fragment);
			},
			m(target, anchor) {
				mount_component(tabbar, target, anchor);
				current = true;
			},
			p(ctx, dirty) {
				const tabbar_changes = {};

				if (dirty[0] & /*tab, likedJokes*/ 536870916 | dirty[1] & /*$$scope*/ 1) {
					tabbar_changes.$$scope = { dirty, ctx };
				}

				if (!updating_active && dirty[0] & /*active*/ 16) {
					updating_active = true;
					tabbar_changes.active = /*active*/ ctx[4];
					add_flush_callback(() => updating_active = false);
				}

				tabbar.$set(tabbar_changes);
			},
			i(local) {
				if (current) return;
				transition_in(tabbar.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(tabbar.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(tabbar, detaching);
			}
		};
	}

	// (122:8) <TopAppBar variant="static" dense={true} style="margin-bottom:20px">
	function create_default_slot_2(ctx) {
		let row;
		let current;

		row = new Row({
				props: {
					$$slots: { default: [create_default_slot_3] },
					$$scope: { ctx }
				}
			});

		return {
			c() {
				create_component(row.$$.fragment);
			},
			m(target, anchor) {
				mount_component(row, target, anchor);
				current = true;
			},
			p(ctx, dirty) {
				const row_changes = {};

				if (dirty[0] & /*active, likedJokes*/ 20 | dirty[1] & /*$$scope*/ 1) {
					row_changes.$$scope = { dirty, ctx };
				}

				row.$set(row_changes);
			},
			i(local) {
				if (current) return;
				transition_in(row.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(row.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(row, detaching);
			}
		};
	}

	// (165:6) {:else}
	function create_else_block_1(ctx) {
		let t;
		let each_blocks = [];
		let each_1_lookup = new Map();
		let each_1_anchor;
		let current;
		let if_block = /*likedJokes*/ ctx[2].length > 0 && create_if_block_7(ctx);
		let each_value_3 = ensure_array_like(/*likedJokes*/ ctx[2]);
		const get_key = ctx => /*joke*/ ctx[15].id;

		for (let i = 0; i < each_value_3.length; i += 1) {
			let child_ctx = get_each_context_3(ctx, each_value_3, i);
			let key = get_key(child_ctx);
			each_1_lookup.set(key, each_blocks[i] = create_each_block_3(key, child_ctx));
		}

		return {
			c() {
				if (if_block) if_block.c();
				t = space();

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				each_1_anchor = empty();
			},
			m(target, anchor) {
				if (if_block) if_block.m(target, anchor);
				insert(target, t, anchor);

				for (let i = 0; i < each_blocks.length; i += 1) {
					if (each_blocks[i]) {
						each_blocks[i].m(target, anchor);
					}
				}

				insert(target, each_1_anchor, anchor);
				current = true;
			},
			p(ctx, dirty) {
				if (/*likedJokes*/ ctx[2].length > 0) {
					if (if_block) {
						if_block.p(ctx, dirty);

						if (dirty[0] & /*likedJokes*/ 4) {
							transition_in(if_block, 1);
						}
					} else {
						if_block = create_if_block_7(ctx);
						if_block.c();
						transition_in(if_block, 1);
						if_block.m(t.parentNode, t);
					}
				} else if (if_block) {
					group_outros();

					transition_out(if_block, 1, 1, () => {
						if_block = null;
					});

					check_outros();
				}

				if (dirty[0] & /*likedJokes, likeJoke, dislikeJoke, selected*/ 420) {
					each_value_3 = ensure_array_like(/*likedJokes*/ ctx[2]);
					group_outros();
					each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value_3, each_1_lookup, each_1_anchor.parentNode, outro_and_destroy_block, create_each_block_3, each_1_anchor, get_each_context_3);
					check_outros();
				}
			},
			i(local) {
				if (current) return;
				transition_in(if_block);

				for (let i = 0; i < each_value_3.length; i += 1) {
					transition_in(each_blocks[i]);
				}

				current = true;
			},
			o(local) {
				transition_out(if_block);

				for (let i = 0; i < each_blocks.length; i += 1) {
					transition_out(each_blocks[i]);
				}

				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(t);
					detach(each_1_anchor);
				}

				if (if_block) if_block.d(detaching);

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].d(detaching);
				}
			}
		};
	}

	// (144:6) {#if active === 'Home'}
	function create_if_block_1(ctx) {
		let t0;
		let each_blocks = [];
		let each1_lookup = new Map();
		let t1;
		let if_block_anchor;
		let current;
		let each_value_2 = ensure_array_like(/*categories*/ ctx[3]);
		let each_blocks_1 = [];

		for (let i = 0; i < each_value_2.length; i += 1) {
			each_blocks_1[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
		}

		const out = i => transition_out(each_blocks_1[i], 1, 1, () => {
			each_blocks_1[i] = null;
		});

		let each_value = ensure_array_like(/*jokesToShow*/ ctx[1]);
		const get_key = ctx => /*joke*/ ctx[15].id;

		for (let i = 0; i < each_value.length; i += 1) {
			let child_ctx = get_each_context(ctx, each_value, i);
			let key = get_key(child_ctx);
			each1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
		}

		let if_block = /*loading*/ ctx[6] && create_if_block_2();

		return {
			c() {
				for (let i = 0; i < each_blocks_1.length; i += 1) {
					each_blocks_1[i].c();
				}

				t0 = space();

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				t1 = space();
				if (if_block) if_block.c();
				if_block_anchor = empty();
			},
			m(target, anchor) {
				for (let i = 0; i < each_blocks_1.length; i += 1) {
					if (each_blocks_1[i]) {
						each_blocks_1[i].m(target, anchor);
					}
				}

				insert(target, t0, anchor);

				for (let i = 0; i < each_blocks.length; i += 1) {
					if (each_blocks[i]) {
						each_blocks[i].m(target, anchor);
					}
				}

				insert(target, t1, anchor);
				if (if_block) if_block.m(target, anchor);
				insert(target, if_block_anchor, anchor);
				current = true;
			},
			p(ctx, dirty) {
				if (dirty[0] & /*categories, selected*/ 40) {
					each_value_2 = ensure_array_like(/*categories*/ ctx[3]);
					let i;

					for (i = 0; i < each_value_2.length; i += 1) {
						const child_ctx = get_each_context_2(ctx, each_value_2, i);

						if (each_blocks_1[i]) {
							each_blocks_1[i].p(child_ctx, dirty);
							transition_in(each_blocks_1[i], 1);
						} else {
							each_blocks_1[i] = create_each_block_2(child_ctx);
							each_blocks_1[i].c();
							transition_in(each_blocks_1[i], 1);
							each_blocks_1[i].m(t0.parentNode, t0);
						}
					}

					group_outros();

					for (i = each_value_2.length; i < each_blocks_1.length; i += 1) {
						out(i);
					}

					check_outros();
				}

				if (dirty[0] & /*jokesToShow, likeJoke, dislikeJoke, selected*/ 418) {
					each_value = ensure_array_like(/*jokesToShow*/ ctx[1]);
					group_outros();
					each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each1_lookup, t1.parentNode, outro_and_destroy_block, create_each_block, t1, get_each_context);
					check_outros();
				}

				if (/*loading*/ ctx[6]) {
					if (if_block) ; else {
						if_block = create_if_block_2();
						if_block.c();
						if_block.m(if_block_anchor.parentNode, if_block_anchor);
					}
				} else if (if_block) {
					if_block.d(1);
					if_block = null;
				}
			},
			i(local) {
				if (current) return;

				for (let i = 0; i < each_value_2.length; i += 1) {
					transition_in(each_blocks_1[i]);
				}

				for (let i = 0; i < each_value.length; i += 1) {
					transition_in(each_blocks[i]);
				}

				current = true;
			},
			o(local) {
				each_blocks_1 = each_blocks_1.filter(Boolean);

				for (let i = 0; i < each_blocks_1.length; i += 1) {
					transition_out(each_blocks_1[i]);
				}

				for (let i = 0; i < each_blocks.length; i += 1) {
					transition_out(each_blocks[i]);
				}

				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(t0);
					detach(t1);
					detach(if_block_anchor);
				}

				destroy_each(each_blocks_1, detaching);

				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].d(detaching);
				}

				if (if_block) if_block.d(detaching);
			}
		};
	}

	// (166:8) {#if likedJokes.length > 0}
	function create_if_block_7(ctx) {
		let each_1_anchor;
		let current;
		let each_value_5 = ensure_array_like(/*categories*/ ctx[3]);
		let each_blocks = [];

		for (let i = 0; i < each_value_5.length; i += 1) {
			each_blocks[i] = create_each_block_5(get_each_context_5(ctx, each_value_5, i));
		}

		const out = i => transition_out(each_blocks[i], 1, 1, () => {
			each_blocks[i] = null;
		});

		return {
			c() {
				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				each_1_anchor = empty();
			},
			m(target, anchor) {
				for (let i = 0; i < each_blocks.length; i += 1) {
					if (each_blocks[i]) {
						each_blocks[i].m(target, anchor);
					}
				}

				insert(target, each_1_anchor, anchor);
				current = true;
			},
			p(ctx, dirty) {
				if (dirty[0] & /*categories, selected*/ 40) {
					each_value_5 = ensure_array_like(/*categories*/ ctx[3]);
					let i;

					for (i = 0; i < each_value_5.length; i += 1) {
						const child_ctx = get_each_context_5(ctx, each_value_5, i);

						if (each_blocks[i]) {
							each_blocks[i].p(child_ctx, dirty);
							transition_in(each_blocks[i], 1);
						} else {
							each_blocks[i] = create_each_block_5(child_ctx);
							each_blocks[i].c();
							transition_in(each_blocks[i], 1);
							each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
						}
					}

					group_outros();

					for (i = each_value_5.length; i < each_blocks.length; i += 1) {
						out(i);
					}

					check_outros();
				}
			},
			i(local) {
				if (current) return;

				for (let i = 0; i < each_value_5.length; i += 1) {
					transition_in(each_blocks[i]);
				}

				current = true;
			},
			o(local) {
				each_blocks = each_blocks.filter(Boolean);

				for (let i = 0; i < each_blocks.length; i += 1) {
					transition_out(each_blocks[i]);
				}

				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(each_1_anchor);
				}

				destroy_each(each_blocks, detaching);
			}
		};
	}

	// (168:12) <FormField>
	function create_default_slot_1(ctx) {
		let checkbox;
		let updating_group;
		let t;
		let current;

		function checkbox_group_binding_1(value) {
			/*checkbox_group_binding_1*/ ctx[11](value);
		}

		let checkbox_props = { value: /*cat*/ ctx[21] };

		if (/*selected*/ ctx[5] !== void 0) {
			checkbox_props.group = /*selected*/ ctx[5];
		}

		checkbox = new Checkbox({ props: checkbox_props });
		binding_callbacks.push(() => bind(checkbox, 'group', checkbox_group_binding_1));

		return {
			c() {
				create_component(checkbox.$$.fragment);
				t = space();
			},
			m(target, anchor) {
				mount_component(checkbox, target, anchor);
				insert(target, t, anchor);
				current = true;
			},
			p(ctx, dirty) {
				const checkbox_changes = {};
				if (dirty[0] & /*categories*/ 8) checkbox_changes.value = /*cat*/ ctx[21];

				if (!updating_group && dirty[0] & /*selected*/ 32) {
					updating_group = true;
					checkbox_changes.group = /*selected*/ ctx[5];
					add_flush_callback(() => updating_group = false);
				}

				checkbox.$set(checkbox_changes);
			},
			i(local) {
				if (current) return;
				transition_in(checkbox.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(checkbox.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(t);
				}

				destroy_component(checkbox, detaching);
			}
		};
	}

	// (170:14) 
	function create_label_slot_1(ctx) {
		let span;
		let t_value = /*cat*/ ctx[21] + "";
		let t;

		return {
			c() {
				span = element("span");
				t = text(t_value);
				attr(span, "slot", "label");
			},
			m(target, anchor) {
				insert(target, span, anchor);
				append(span, t);
			},
			p(ctx, dirty) {
				if (dirty[0] & /*categories*/ 8 && t_value !== (t_value = /*cat*/ ctx[21] + "")) set_data(t, t_value);
			},
			d(detaching) {
				if (detaching) {
					detach(span);
				}
			}
		};
	}

	// (167:10) {#each categories as cat}
	function create_each_block_5(ctx) {
		let formfield;
		let current;

		formfield = new FormField({
				props: {
					$$slots: {
						label: [create_label_slot_1],
						default: [create_default_slot_1]
					},
					$$scope: { ctx }
				}
			});

		return {
			c() {
				create_component(formfield.$$.fragment);
			},
			m(target, anchor) {
				mount_component(formfield, target, anchor);
				current = true;
			},
			p(ctx, dirty) {
				const formfield_changes = {};

				if (dirty[0] & /*categories, selected*/ 40 | dirty[1] & /*$$scope*/ 1) {
					formfield_changes.$$scope = { dirty, ctx };
				}

				formfield.$set(formfield_changes);
			},
			i(local) {
				if (current) return;
				transition_in(formfield.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(formfield.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(formfield, detaching);
			}
		};
	}

	// (177:10) {:else}
	function create_else_block_2(ctx) {
		let each_1_anchor;
		let current;
		let each_value_4 = ensure_array_like(/*joke*/ ctx[15].categories);
		let each_blocks = [];

		for (let i = 0; i < each_value_4.length; i += 1) {
			each_blocks[i] = create_each_block_4(get_each_context_4(ctx, each_value_4, i));
		}

		const out = i => transition_out(each_blocks[i], 1, 1, () => {
			each_blocks[i] = null;
		});

		return {
			c() {
				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				each_1_anchor = empty();
			},
			m(target, anchor) {
				for (let i = 0; i < each_blocks.length; i += 1) {
					if (each_blocks[i]) {
						each_blocks[i].m(target, anchor);
					}
				}

				insert(target, each_1_anchor, anchor);
				current = true;
			},
			p(ctx, dirty) {
				if (dirty[0] & /*likedJokes, likeJoke, dislikeJoke, selected*/ 420) {
					each_value_4 = ensure_array_like(/*joke*/ ctx[15].categories);
					let i;

					for (i = 0; i < each_value_4.length; i += 1) {
						const child_ctx = get_each_context_4(ctx, each_value_4, i);

						if (each_blocks[i]) {
							each_blocks[i].p(child_ctx, dirty);
							transition_in(each_blocks[i], 1);
						} else {
							each_blocks[i] = create_each_block_4(child_ctx);
							each_blocks[i].c();
							transition_in(each_blocks[i], 1);
							each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
						}
					}

					group_outros();

					for (i = each_value_4.length; i < each_blocks.length; i += 1) {
						out(i);
					}

					check_outros();
				}
			},
			i(local) {
				if (current) return;

				for (let i = 0; i < each_value_4.length; i += 1) {
					transition_in(each_blocks[i]);
				}

				current = true;
			},
			o(local) {
				each_blocks = each_blocks.filter(Boolean);

				for (let i = 0; i < each_blocks.length; i += 1) {
					transition_out(each_blocks[i]);
				}

				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(each_1_anchor);
				}

				destroy_each(each_blocks, detaching);
			}
		};
	}

	// (175:10) {#if joke.categories.length === 0}
	function create_if_block_5(ctx) {
		let card;
		let current;

		const card_spread_levels = [
			/*joke*/ ctx[15],
			{ i: /*i*/ ctx[17] },
			{ likeJoke: /*likeJoke*/ ctx[7] },
			{ dislikeJoke: /*dislikeJoke*/ ctx[8] }
		];

		let card_props = {};

		for (let i = 0; i < card_spread_levels.length; i += 1) {
			card_props = assign(card_props, card_spread_levels[i]);
		}

		card = new Card_1({ props: card_props });

		return {
			c() {
				create_component(card.$$.fragment);
			},
			m(target, anchor) {
				mount_component(card, target, anchor);
				current = true;
			},
			p(ctx, dirty) {
				const card_changes = (dirty[0] & /*likedJokes, likeJoke, dislikeJoke*/ 388)
				? get_spread_update(card_spread_levels, [
						dirty[0] & /*likedJokes*/ 4 && get_spread_object(/*joke*/ ctx[15]),
						dirty[0] & /*likedJokes*/ 4 && { i: /*i*/ ctx[17] },
						dirty[0] & /*likeJoke*/ 128 && { likeJoke: /*likeJoke*/ ctx[7] },
						dirty[0] & /*dislikeJoke*/ 256 && { dislikeJoke: /*dislikeJoke*/ ctx[8] }
					])
				: {};

				card.$set(card_changes);
			},
			i(local) {
				if (current) return;
				transition_in(card.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(card.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(card, detaching);
			}
		};
	}

	// (179:14) {#if selected.includes(category) || joke.categories.length === 0}
	function create_if_block_6(ctx) {
		let card;
		let current;

		const card_spread_levels = [
			/*joke*/ ctx[15],
			{ i: /*i*/ ctx[17] },
			{ likeJoke: /*likeJoke*/ ctx[7] },
			{ dislikeJoke: /*dislikeJoke*/ ctx[8] }
		];

		let card_props = {};

		for (let i = 0; i < card_spread_levels.length; i += 1) {
			card_props = assign(card_props, card_spread_levels[i]);
		}

		card = new Card_1({ props: card_props });

		return {
			c() {
				create_component(card.$$.fragment);
			},
			m(target, anchor) {
				mount_component(card, target, anchor);
				current = true;
			},
			p(ctx, dirty) {
				const card_changes = (dirty[0] & /*likedJokes, likeJoke, dislikeJoke*/ 388)
				? get_spread_update(card_spread_levels, [
						dirty[0] & /*likedJokes*/ 4 && get_spread_object(/*joke*/ ctx[15]),
						dirty[0] & /*likedJokes*/ 4 && { i: /*i*/ ctx[17] },
						dirty[0] & /*likeJoke*/ 128 && { likeJoke: /*likeJoke*/ ctx[7] },
						dirty[0] & /*dislikeJoke*/ 256 && { dislikeJoke: /*dislikeJoke*/ ctx[8] }
					])
				: {};

				card.$set(card_changes);
			},
			i(local) {
				if (current) return;
				transition_in(card.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(card.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(card, detaching);
			}
		};
	}

	// (178:12) {#each joke.categories as category}
	function create_each_block_4(ctx) {
		let show_if = /*selected*/ ctx[5].includes(/*category*/ ctx[18]) || /*joke*/ ctx[15].categories.length === 0;
		let if_block_anchor;
		let current;
		let if_block = show_if && create_if_block_6(ctx);

		return {
			c() {
				if (if_block) if_block.c();
				if_block_anchor = empty();
			},
			m(target, anchor) {
				if (if_block) if_block.m(target, anchor);
				insert(target, if_block_anchor, anchor);
				current = true;
			},
			p(ctx, dirty) {
				if (dirty[0] & /*selected, likedJokes*/ 36) show_if = /*selected*/ ctx[5].includes(/*category*/ ctx[18]) || /*joke*/ ctx[15].categories.length === 0;

				if (show_if) {
					if (if_block) {
						if_block.p(ctx, dirty);

						if (dirty[0] & /*selected, likedJokes*/ 36) {
							transition_in(if_block, 1);
						}
					} else {
						if_block = create_if_block_6(ctx);
						if_block.c();
						transition_in(if_block, 1);
						if_block.m(if_block_anchor.parentNode, if_block_anchor);
					}
				} else if (if_block) {
					group_outros();

					transition_out(if_block, 1, 1, () => {
						if_block = null;
					});

					check_outros();
				}
			},
			i(local) {
				if (current) return;
				transition_in(if_block);
				current = true;
			},
			o(local) {
				transition_out(if_block);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(if_block_anchor);
				}

				if (if_block) if_block.d(detaching);
			}
		};
	}

	// (174:8) {#each likedJokes as joke, i (joke.id)}
	function create_each_block_3(key_1, ctx) {
		let first;
		let current_block_type_index;
		let if_block;
		let if_block_anchor;
		let current;
		const if_block_creators = [create_if_block_5, create_else_block_2];
		const if_blocks = [];

		function select_block_type_2(ctx, dirty) {
			if (/*joke*/ ctx[15].categories.length === 0) return 0;
			return 1;
		}

		current_block_type_index = select_block_type_2(ctx);
		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

		return {
			key: key_1,
			first: null,
			c() {
				first = empty();
				if_block.c();
				if_block_anchor = empty();
				this.first = first;
			},
			m(target, anchor) {
				insert(target, first, anchor);
				if_blocks[current_block_type_index].m(target, anchor);
				insert(target, if_block_anchor, anchor);
				current = true;
			},
			p(new_ctx, dirty) {
				ctx = new_ctx;
				let previous_block_index = current_block_type_index;
				current_block_type_index = select_block_type_2(ctx);

				if (current_block_type_index === previous_block_index) {
					if_blocks[current_block_type_index].p(ctx, dirty);
				} else {
					group_outros();

					transition_out(if_blocks[previous_block_index], 1, 1, () => {
						if_blocks[previous_block_index] = null;
					});

					check_outros();
					if_block = if_blocks[current_block_type_index];

					if (!if_block) {
						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
						if_block.c();
					} else {
						if_block.p(ctx, dirty);
					}

					transition_in(if_block, 1);
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			},
			i(local) {
				if (current) return;
				transition_in(if_block);
				current = true;
			},
			o(local) {
				transition_out(if_block);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(first);
					detach(if_block_anchor);
				}

				if_blocks[current_block_type_index].d(detaching);
			}
		};
	}

	// (146:10) <FormField>
	function create_default_slot(ctx) {
		let checkbox;
		let updating_group;
		let current;

		function checkbox_group_binding(value) {
			/*checkbox_group_binding*/ ctx[10](value);
		}

		let checkbox_props = { value: /*cat*/ ctx[21] };

		if (/*selected*/ ctx[5] !== void 0) {
			checkbox_props.group = /*selected*/ ctx[5];
		}

		checkbox = new Checkbox({ props: checkbox_props });
		binding_callbacks.push(() => bind(checkbox, 'group', checkbox_group_binding));

		return {
			c() {
				create_component(checkbox.$$.fragment);
			},
			m(target, anchor) {
				mount_component(checkbox, target, anchor);
				current = true;
			},
			p(ctx, dirty) {
				const checkbox_changes = {};
				if (dirty[0] & /*categories*/ 8) checkbox_changes.value = /*cat*/ ctx[21];

				if (!updating_group && dirty[0] & /*selected*/ 32) {
					updating_group = true;
					checkbox_changes.group = /*selected*/ ctx[5];
					add_flush_callback(() => updating_group = false);
				}

				checkbox.$set(checkbox_changes);
			},
			i(local) {
				if (current) return;
				transition_in(checkbox.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(checkbox.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(checkbox, detaching);
			}
		};
	}

	// (148:12) 
	function create_label_slot(ctx) {
		let span;
		let t_value = /*cat*/ ctx[21] + "";
		let t;

		return {
			c() {
				span = element("span");
				t = text(t_value);
				attr(span, "slot", "label");
			},
			m(target, anchor) {
				insert(target, span, anchor);
				append(span, t);
			},
			p(ctx, dirty) {
				if (dirty[0] & /*categories*/ 8 && t_value !== (t_value = /*cat*/ ctx[21] + "")) set_data(t, t_value);
			},
			d(detaching) {
				if (detaching) {
					detach(span);
				}
			}
		};
	}

	// (145:8) {#each categories as cat}
	function create_each_block_2(ctx) {
		let formfield;
		let current;

		formfield = new FormField({
				props: {
					$$slots: {
						label: [create_label_slot],
						default: [create_default_slot]
					},
					$$scope: { ctx }
				}
			});

		return {
			c() {
				create_component(formfield.$$.fragment);
			},
			m(target, anchor) {
				mount_component(formfield, target, anchor);
				current = true;
			},
			p(ctx, dirty) {
				const formfield_changes = {};

				if (dirty[0] & /*categories, selected*/ 40 | dirty[1] & /*$$scope*/ 1) {
					formfield_changes.$$scope = { dirty, ctx };
				}

				formfield.$set(formfield_changes);
			},
			i(local) {
				if (current) return;
				transition_in(formfield.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(formfield.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(formfield, detaching);
			}
		};
	}

	// (154:10) {:else}
	function create_else_block(ctx) {
		let each_1_anchor;
		let current;
		let each_value_1 = ensure_array_like(/*joke*/ ctx[15].categories);
		let each_blocks = [];

		for (let i = 0; i < each_value_1.length; i += 1) {
			each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
		}

		const out = i => transition_out(each_blocks[i], 1, 1, () => {
			each_blocks[i] = null;
		});

		return {
			c() {
				for (let i = 0; i < each_blocks.length; i += 1) {
					each_blocks[i].c();
				}

				each_1_anchor = empty();
			},
			m(target, anchor) {
				for (let i = 0; i < each_blocks.length; i += 1) {
					if (each_blocks[i]) {
						each_blocks[i].m(target, anchor);
					}
				}

				insert(target, each_1_anchor, anchor);
				current = true;
			},
			p(ctx, dirty) {
				if (dirty[0] & /*jokesToShow, likeJoke, dislikeJoke, selected*/ 418) {
					each_value_1 = ensure_array_like(/*joke*/ ctx[15].categories);
					let i;

					for (i = 0; i < each_value_1.length; i += 1) {
						const child_ctx = get_each_context_1(ctx, each_value_1, i);

						if (each_blocks[i]) {
							each_blocks[i].p(child_ctx, dirty);
							transition_in(each_blocks[i], 1);
						} else {
							each_blocks[i] = create_each_block_1(child_ctx);
							each_blocks[i].c();
							transition_in(each_blocks[i], 1);
							each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
						}
					}

					group_outros();

					for (i = each_value_1.length; i < each_blocks.length; i += 1) {
						out(i);
					}

					check_outros();
				}
			},
			i(local) {
				if (current) return;

				for (let i = 0; i < each_value_1.length; i += 1) {
					transition_in(each_blocks[i]);
				}

				current = true;
			},
			o(local) {
				each_blocks = each_blocks.filter(Boolean);

				for (let i = 0; i < each_blocks.length; i += 1) {
					transition_out(each_blocks[i]);
				}

				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(each_1_anchor);
				}

				destroy_each(each_blocks, detaching);
			}
		};
	}

	// (152:10) {#if joke.categories.length === 0}
	function create_if_block_3(ctx) {
		let card;
		let current;

		const card_spread_levels = [
			/*joke*/ ctx[15],
			{ i: /*i*/ ctx[17] },
			{ likeJoke: /*likeJoke*/ ctx[7] },
			{ dislikeJoke: /*dislikeJoke*/ ctx[8] }
		];

		let card_props = {};

		for (let i = 0; i < card_spread_levels.length; i += 1) {
			card_props = assign(card_props, card_spread_levels[i]);
		}

		card = new Card_1({ props: card_props });

		return {
			c() {
				create_component(card.$$.fragment);
			},
			m(target, anchor) {
				mount_component(card, target, anchor);
				current = true;
			},
			p(ctx, dirty) {
				const card_changes = (dirty[0] & /*jokesToShow, likeJoke, dislikeJoke*/ 386)
				? get_spread_update(card_spread_levels, [
						dirty[0] & /*jokesToShow*/ 2 && get_spread_object(/*joke*/ ctx[15]),
						dirty[0] & /*jokesToShow*/ 2 && { i: /*i*/ ctx[17] },
						dirty[0] & /*likeJoke*/ 128 && { likeJoke: /*likeJoke*/ ctx[7] },
						dirty[0] & /*dislikeJoke*/ 256 && { dislikeJoke: /*dislikeJoke*/ ctx[8] }
					])
				: {};

				card.$set(card_changes);
			},
			i(local) {
				if (current) return;
				transition_in(card.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(card.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(card, detaching);
			}
		};
	}

	// (156:14) {#if selected.includes(category) || joke.categories.length === 0}
	function create_if_block_4(ctx) {
		let card;
		let current;

		const card_spread_levels = [
			/*joke*/ ctx[15],
			{ i: /*i*/ ctx[17] },
			{ likeJoke: /*likeJoke*/ ctx[7] },
			{ dislikeJoke: /*dislikeJoke*/ ctx[8] }
		];

		let card_props = {};

		for (let i = 0; i < card_spread_levels.length; i += 1) {
			card_props = assign(card_props, card_spread_levels[i]);
		}

		card = new Card_1({ props: card_props });

		return {
			c() {
				create_component(card.$$.fragment);
			},
			m(target, anchor) {
				mount_component(card, target, anchor);
				current = true;
			},
			p(ctx, dirty) {
				const card_changes = (dirty[0] & /*jokesToShow, likeJoke, dislikeJoke*/ 386)
				? get_spread_update(card_spread_levels, [
						dirty[0] & /*jokesToShow*/ 2 && get_spread_object(/*joke*/ ctx[15]),
						dirty[0] & /*jokesToShow*/ 2 && { i: /*i*/ ctx[17] },
						dirty[0] & /*likeJoke*/ 128 && { likeJoke: /*likeJoke*/ ctx[7] },
						dirty[0] & /*dislikeJoke*/ 256 && { dislikeJoke: /*dislikeJoke*/ ctx[8] }
					])
				: {};

				card.$set(card_changes);
			},
			i(local) {
				if (current) return;
				transition_in(card.$$.fragment, local);
				current = true;
			},
			o(local) {
				transition_out(card.$$.fragment, local);
				current = false;
			},
			d(detaching) {
				destroy_component(card, detaching);
			}
		};
	}

	// (155:12) {#each joke.categories as category}
	function create_each_block_1(ctx) {
		let show_if = /*selected*/ ctx[5].includes(/*category*/ ctx[18]) || /*joke*/ ctx[15].categories.length === 0;
		let if_block_anchor;
		let current;
		let if_block = show_if && create_if_block_4(ctx);

		return {
			c() {
				if (if_block) if_block.c();
				if_block_anchor = empty();
			},
			m(target, anchor) {
				if (if_block) if_block.m(target, anchor);
				insert(target, if_block_anchor, anchor);
				current = true;
			},
			p(ctx, dirty) {
				if (dirty[0] & /*selected, jokesToShow*/ 34) show_if = /*selected*/ ctx[5].includes(/*category*/ ctx[18]) || /*joke*/ ctx[15].categories.length === 0;

				if (show_if) {
					if (if_block) {
						if_block.p(ctx, dirty);

						if (dirty[0] & /*selected, jokesToShow*/ 34) {
							transition_in(if_block, 1);
						}
					} else {
						if_block = create_if_block_4(ctx);
						if_block.c();
						transition_in(if_block, 1);
						if_block.m(if_block_anchor.parentNode, if_block_anchor);
					}
				} else if (if_block) {
					group_outros();

					transition_out(if_block, 1, 1, () => {
						if_block = null;
					});

					check_outros();
				}
			},
			i(local) {
				if (current) return;
				transition_in(if_block);
				current = true;
			},
			o(local) {
				transition_out(if_block);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(if_block_anchor);
				}

				if (if_block) if_block.d(detaching);
			}
		};
	}

	// (151:8) {#each jokesToShow as joke, i (joke.id)}
	function create_each_block(key_1, ctx) {
		let first;
		let current_block_type_index;
		let if_block;
		let if_block_anchor;
		let current;
		const if_block_creators = [create_if_block_3, create_else_block];
		const if_blocks = [];

		function select_block_type_1(ctx, dirty) {
			if (/*joke*/ ctx[15].categories.length === 0) return 0;
			return 1;
		}

		current_block_type_index = select_block_type_1(ctx);
		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

		return {
			key: key_1,
			first: null,
			c() {
				first = empty();
				if_block.c();
				if_block_anchor = empty();
				this.first = first;
			},
			m(target, anchor) {
				insert(target, first, anchor);
				if_blocks[current_block_type_index].m(target, anchor);
				insert(target, if_block_anchor, anchor);
				current = true;
			},
			p(new_ctx, dirty) {
				ctx = new_ctx;
				let previous_block_index = current_block_type_index;
				current_block_type_index = select_block_type_1(ctx);

				if (current_block_type_index === previous_block_index) {
					if_blocks[current_block_type_index].p(ctx, dirty);
				} else {
					group_outros();

					transition_out(if_blocks[previous_block_index], 1, 1, () => {
						if_blocks[previous_block_index] = null;
					});

					check_outros();
					if_block = if_blocks[current_block_type_index];

					if (!if_block) {
						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
						if_block.c();
					} else {
						if_block.p(ctx, dirty);
					}

					transition_in(if_block, 1);
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			},
			i(local) {
				if (current) return;
				transition_in(if_block);
				current = true;
			},
			o(local) {
				transition_out(if_block);
				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(first);
					detach(if_block_anchor);
				}

				if_blocks[current_block_type_index].d(detaching);
			}
		};
	}

	// (162:8) {#if loading}
	function create_if_block_2(ctx) {
		let div;

		return {
			c() {
				div = element("div");
				attr(div, "class", "loader lower svelte-x492so");
			},
			m(target, anchor) {
				insert(target, div, anchor);
			},
			d(detaching) {
				if (detaching) {
					detach(div);
				}
			}
		};
	}

	// (117:18)      <div class="loader" />   {:then}
	function create_pending_block(ctx) {
		let div;

		return {
			c() {
				div = element("div");
				attr(div, "class", "loader svelte-x492so");
			},
			m(target, anchor) {
				insert(target, div, anchor);
			},
			p: noop,
			i: noop,
			o: noop,
			d(detaching) {
				if (detaching) {
					detach(div);
				}
			}
		};
	}

	function create_fragment(ctx) {
		let main;
		let div;
		let t1;
		let promise_1;
		let current;

		let info = {
			ctx,
			current: null,
			token: null,
			hasCatch: true,
			pending: create_pending_block,
			then: create_then_block,
			catch: create_catch_block,
			error: 30,
			blocks: [,,,]
		};

		handle_promise(promise_1 = /*promise*/ ctx[0], info);

		return {
			c() {
				main = element("main");
				div = element("div");
				div.textContent = "Chuck Norris jokes";
				t1 = space();
				info.block.c();
				attr(div, "class", "mdc-typography--headline2");
				attr(div, "align", "center");
				set_style(div, "font-weight", "500");
				set_style(div, "margin-bottom", "20px");
				attr(main, "class", "container svelte-x492so");
			},
			m(target, anchor) {
				insert(target, main, anchor);
				append(main, div);
				append(main, t1);
				info.block.m(main, info.anchor = null);
				info.mount = () => main;
				info.anchor = null;
				current = true;
			},
			p(new_ctx, dirty) {
				ctx = new_ctx;
				info.ctx = ctx;

				if (dirty[0] & /*promise*/ 1 && promise_1 !== (promise_1 = /*promise*/ ctx[0]) && handle_promise(promise_1, info)) ; else {
					update_await_block_branch(info, ctx, dirty);
				}
			},
			i(local) {
				if (current) return;
				transition_in(info.block);
				current = true;
			},
			o(local) {
				for (let i = 0; i < 3; i += 1) {
					const block = info.blocks[i];
					transition_out(block);
				}

				current = false;
			},
			d(detaching) {
				if (detaching) {
					detach(main);
				}

				info.block.d();
				info.token = null;
				info = null;
			}
		};
	}

	function instance($$self, $$props, $$invalidate) {
		let promise;
		let jokesArr;
		let jokesToShow;
		let likedJokes = [];
		let categories;
		let active = "Home";
		let selected;
		let loading = false;

		onMount(() => {
			const getJokes = async () => {
				const res = await fetch("https://api.icndb.com/jokes");
				const jokes = await res.json();

				if (res.ok) {
					jokesArr = jokes.value;
					$$invalidate(1, jokesToShow = jokesArr.slice(0, 10));
					setTimeout(() => observeCard(jokesToShow), 100);
					const cat = await fetch("https://api.icndb.com/categories");
					const cats = await cat.json();
					$$invalidate(3, categories = cats.value);
					$$invalidate(5, selected = [...categories]);
				} else {
					throw new Error(jokes);
				}
			};

			$$invalidate(0, promise = getJokes());
		});

		const likeJoke = id => {
			if (likedJokes.find(joke => joke.id === id)) return;
			const likedJoke = jokesToShow.find(joke => joke.id === id);
			$$invalidate(2, likedJokes = likedJokes.concat(likedJoke));
		};

		const dislikeJoke = id => {
			const newLikedJokes = likedJokes.filter(joke => joke.id !== id);
			$$invalidate(2, likedJokes = newLikedJokes);
		};

		const observeCard = jokesToShow => {
			const bottomJokeIndex = `joke-${jokesToShow.length - 1}`;
			const bottomJoke = document.getElementById(bottomJokeIndex);

			const observer = new IntersectionObserver(entries => {
					if (entries[0].isIntersecting === true) {
						$$invalidate(6, loading = true);

						setTimeout(
							() => {
								addMoreJokes();
							},
							600
						);

						observer.unobserve(bottomJoke);
					}
				},
			{ threshold: 1 });

			if (bottomJoke) {
				observer.observe(bottomJoke);
			}
		};

		const addMoreJokes = async () => {
			const updatedJokesToShow = jokesArr.slice(0, jokesToShow.length + 10);
			$$invalidate(1, jokesToShow = updatedJokesToShow);
			await tick();
			$$invalidate(6, loading = false);
			observeCard(jokesToShow);
		};

		function tabbar_active_binding(value) {
			active = value;
			$$invalidate(4, active);
		}

		function checkbox_group_binding(value) {
			selected = value;
			$$invalidate(5, selected);
		}

		function checkbox_group_binding_1(value) {
			selected = value;
			$$invalidate(5, selected);
		}

		return [
			promise,
			jokesToShow,
			likedJokes,
			categories,
			active,
			selected,
			loading,
			likeJoke,
			dislikeJoke,
			tabbar_active_binding,
			checkbox_group_binding,
			checkbox_group_binding_1
		];
	}

	class App extends SvelteComponent {
		constructor(options) {
			super();
			init(this, options, instance, create_fragment, safe_not_equal, {}, null, [-1, -1]);
		}
	}

	const app = new App({
	  target: document.body,
	});

	return app;

})();
//# sourceMappingURL=bundle.js.map
