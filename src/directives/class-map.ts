/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

import {AttributePart, directive, Part, PropertyPart} from '../lit-html.js';

// IE11 doesn't support classList on SVG elements, so we emulate it with a Set
class ClassList {
  element: Element|undefined;
  part: AttributePart|undefined;
  classes: Set<string> = new Set();
  changed = true;

  constructor(elementOrPart: Element|AttributePart) {
    let classList;
    if (elementOrPart instanceof AttributePart) {
      this.part = elementOrPart;
      this.element = undefined;
      classList = this.part.committer.strings.join(' ');
    } else {
      this.part = undefined;
      this.element = elementOrPart;
      classList = (this.element.getAttribute('class') || '').split(/\s+/);
    }
    for (const cls of classList) {
      this.classes.add(cls);
    }
  }
  add(cls: string) {
    this.classes.add(cls);
    this.changed = true;
  }

  remove(cls: string) {
    this.classes.delete(cls);
    this.changed = true;
  }

  commit() {
    if (this.changed) {
      let classString = '';
      this.classes.forEach((cls) => classString += cls + ' ');
      if (this.element !== undefined) {
        this.element.setAttribute('class', classString);
      } else {
        this.part!.setValue(classString);
      }
    }
  }
}

export interface ClassInfo {
  readonly [name: string]: string|boolean|number;
}

/**
 * Stores the ClassInfo object applied to a given AttributePart.
 * Used to unset existing values when a new ClassInfo object is applied.
 */
const previousClassesCache = new WeakMap<Part, Set<string>>();

/**
 * A directive that applies CSS classes. This must be used in the `class`
 * attribute and must be the only part used in the attribute. It takes each
 * property in the `classInfo` argument and adds the property name to the
 * element's `class` if the property value is truthy; if the property value is
 * falsey, the property name is removed from the element's `class`. For example
 * `{foo: bar}` applies the class `foo` if the value of `bar` is truthy.
 * @param classInfo {ClassInfo}
 */
export const classMap = directive((classInfo: ClassInfo) => (part: Part) => {
  if (!(part instanceof AttributePart) || (part instanceof PropertyPart) ||
      part.committer.name !== 'class' || part.committer.parts.length > 1) {
    throw new Error(
        'The `classMap` directive must be used in the `class` attribute ' +
        'and must be the only part in the attribute.');
  }

  const {committer} = part;

  let classList: DOMTokenList|ClassList;
  let previousClasses = previousClassesCache.get(part);
  if (previousClasses === undefined) {
    classList = new ClassList(part);
    previousClassesCache.set(part, previousClasses = new Set());
  } else {
    const {element} = committer;
    classList = element.classList || new ClassList(element);
  }


  // Remove old classes that no longer apply
  // We use forEach() instead of for-of so that re don't require down-level
  // iteration.
  previousClasses.forEach((name) => {
    if (!(name in classInfo)) {
      classList.remove(name);
      previousClasses!.delete(name);
    }
  });

  // Add or remove classes based on their classMap value
  for (const name in classInfo) {
    const value = classInfo[name];
    if (value != previousClasses.has(name)) {
      // We explicitly want a loose truthy check of `value` because it seems
      // more convenient that '' and 0 are skipped.
      if (value) {
        classList.add(name);
        previousClasses.add(name);
      } else {
        classList.remove(name);
        previousClasses.delete(name);
      }
    }
  }
  if (typeof (classList as ClassList).commit === 'function') {
    (classList as ClassList).commit();
  }
});
