/*
 * ADOBE CONFIDENTIAL
 *
 * Copyright 2018 Adobe Systems Incorporated
 * All Rights Reserved.
 *
 * NOTICE:  All information contained herein is, and remains
 * the property of Adobe Systems Incorporated and its suppliers,
 * if any.  The intellectual and technical concepts contained
 * herein are proprietary to Adobe Systems Incorporated and its
 * suppliers and may be covered by U.S. and Foreign Patents,
 * patents in process, and are protected by trade secret or copyright law.
 * Dissemination of this information or reproduction of this material
 * is strictly forbidden unless prior written permission is obtained
 * from Adobe Systems Incorporated.
 */

const CLASSNAME = 'coral3-Banner-content';

/**
 @class Coral.Card.Banner.Content
 @classdesc A Card Banner Content component
 @htmltag coral-card-banner-content
 @extends {HTMLElement}
 */
class CardBannerContent extends HTMLElement {
  /** @ignore */
  connectedCallback() {
    this.classList.add(CLASSNAME);
  }
}

export default CardBannerContent;
