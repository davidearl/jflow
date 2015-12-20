(function($){
	$.fn.flow = function(contents, options){
		var settings = $.extend({
			
			box: ".box",           /* selector for boxes to flow content into */

			pagination: "simplex", /* * "simplex": meaning start each new content on a new first page 
									    following on from the previous page, typically for single side 
										printing, or...
									  * "duplex": start each content on a new  first page, but insert a 
									    blank page in between to make the first page be an odd-numbered
									    page, typically for double-sided (duplex) printing, or...
									  * "repeat": start each content in next available box, for example
									    to produce mailing labels many-up on the same sheet */			
			keeptogether: "keep-together",
			                       /* contents of elements with this class name are treated as a whole,
									  moved to the next box if the whole element does not fit where it
									  is. Beware that if no box can accommodate the element, you can
									  get into an infinite loop */
			advancebefore: "advance-before",
			                       /* always move this element to a new box (unless it is already 
									  at the start of a box) */
			pagenumber: "page-number",
			                       /* at the end, the contents of any element of this class are
									  replaced with the page number (starting again at 1 for
									  each content). Make sure the element is positioned to
									  allow for it to vary in length a bitm, perhaps by
									  including placeholder content. There is no reflow if it
									  gets bigger. */

			classprefix: "jf_"     /* various class names are added to elements; they all start with
									  this prefix. You only need to change this if there is a clash
									  with your own class names */
		}, options);

		var c_splithere = settings.classprefix+"sh";
		var	c_formertext = settings.classprefix+"ft";
		var c_leaf = settings.classprefix+"lf";
		var c_dividethis = settings.classprefix+"jf";
		var c_insertionpoint = settings.classprefix+"ip";

		var jthis = this;
		var jip = $("<div>").addClass(c_insertionpoint);
		jthis.first().before(jip); // to act as an insertion point
		var jpages = jthis.detach(); // because we're going to add back multiple copies as we go
		var jallpages = $([]);
		var jboxes = $([]); // these are the boxes within those inserted copies
		var ibox = 0; var ipage = 0; var ipagenumber = 0;

		var fits = function(el, boxbottom) {
			/* Checks DOM element el to see if it fits in container jbox (true) or not (false). The
			   first leaf element which overflows is marked with the class c_splithere and each
			   of its parents with dividethis.

			   To do this it has to traverse the dom tree seeing if each successively
			   smaller element fits. To complicate matters, we can't measure the position of individual
			   words without turning them into elements.
			*/
			var jel = $(el);
			switch (el.nodeType) {
			case 8: /* comment */ return true;
			case 3: /* text */
				/* put text into their own span so we can measure their position
				   (.offset doesn't work for text nodes) */
				if (el.textContent.match(/^\s+$/)) {
					return true; /* don't bother about completely white space */
				}
				var jspan = $("<span>").text(el.textContent).addClass(c_formertext);
				jel.replaceWith(jspan);
				jel = jspan;
				break;
			case 1: /* ordinary */ break;
			default:
				console.log("element other ordinary, text or comment encountered: "+el.nodeType);
				return true;
			}
			if (jel.hasClass(settings.advancebefore) && jel.position().top > 0) {
				/* it's not atthe top of a box, but we're being asked to make it so */
				jel.addClass(c_splithere).addClass(c_leaf).removeClass(settings.advancebefore);
				return false;
			} else if (jel.offset().top + jel.height() < boxbottom) {
				/* if the element is all visible, move on to the next one */
				return true;
			} else if (jel.hasClass(settings.keeptogether)) {
				/* we just determined it won't fit, so we don't need to inspect the contents if we're 
				   being asked to keep the whole lot together */
				jel.addClass(c_splithere).addClass(c_leaf);
				return false;
			} else if (jel.hasClass(c_formertext)) {
				/* divide the former text into word spans and then look at each */
				var s = jel.html();
				var jspan = $("<span>");
				if (s.match(/^\s+/)) { jspan.append(" "); }
				var split = s.split(/\s+/);
				$.each(split, function(i,v) {
					if (v == "") { return true; }
					jspan.append($("<span>").addClass(c_leaf).text(v));
					if (i < split.length-1 || s.match(/\s+$/)) { jspan.append(" "); }
				});
				jel.replaceWith(jspan);
				var itfits = true;
				jspan.children().each(function(){
					itfits = fits(this, boxbottom);
					return itfits;
				});
				if (itfits) { return true; }
				jspan.removeClass(c_formertext).addClass(c_dividethis);
				return false;
			} else if (! jel.hasClass(c_leaf) && el.nodeName != "IMG" && el.nodeName != "HR") {
				/* descend into the node to do the same recursively. Note: IMG and HR are the
				   only void elements (elements without content by definition) which have
				   physical extent on the page and therefore act as leaf nodes */
				var itfits = true;
				jel.contents().each(function(){
					itfits = fits(this, boxbottom);
					return itfits;
				});
				if (itfits) { return true; }
				jel.addClass(c_dividethis);
				return false;
			} else {
				jel.addClass(c_splithere);
				return false;
			}
		}

		var divide = function(el, jparent2){
			/* Divides the DOM element el, moving the splithere element and successors to jparent2
			   (creating a node for that if needed), and applying the same to the ancestors. Remove the
			   marker classes so we can do the same again for overflow of jparent2.
			 */
			if (el.nodeType == 8) { return jparent2; }
			var jel = $(el);
			if (el.nodeType == 3) {
				if (jparent2) { return jparent2.append(el); }
			} else if (jel.hasClass(c_splithere)) { /* the point of the split */
				jel.removeClass(c_splithere);
				return $(jel.parent().get(0).cloneNode(false)).append(el);				
			} else if (jel.hasClass(c_dividethis)) { /* split between part1 and part2 */
				var jpart2 = null;
				jel.removeClass(c_dividethis).contents().each(function(){
					jpart2 = divide(this, jpart2);
				});
				if (! jpart2) { return null; }
				if (jparent2) { return jparent2.append(jpart2); }
				return $(jel.parent().get(0).cloneNode(false)).append(jpart2);				
			} else if (jparent2) { /* move into part2 */
				return jparent2.append(el);				
			}
			return null;
		}

		var nextbox = function(first){
			if (! first) { ibox++; }
			while (ibox >= jboxes.length) {
				/* we've run out of boxes on this page, add another page (the same as the final one
				   if there are no more pages). WARNING: if at least one subsequent page in the
				   page templates doesn't add a box, this will loop forever; but having a loop
				   allows you to insert blank pages. */
				if (! first) {
					if (++ipage == jpages.length) { ipage--; }
				}
				var jpage = jpages.eq(ipage).clone();
				jboxes = jboxes.add(jpage.insertBefore(jip).find(settings.box));
				jallpages = jallpages.add(jpage);
				ipagenumber++;
				jpage.attr(settings.pagenumber, ipagenumber);
			}
		}

		var nextpage = function() {
			var jpage = jpages.first().clone();
			jboxes = jpage.insertBefore(jip).find(settings.box);
			jallpages = jallpages.add(jpage);
			ipage = ibox = 0;
			ipagenumber++;
			jpage.attr(settings.pagenumber, ipagenumber);
		}
		
		/* flow each content into its own sequence of pages... */
		var first = true;
		$(contents).each(function(i, content){
			/* simplex and duplex start on the first page of the page templates, but 'repeat' 
			   flows in to the next available box */
			ipagenumber = 0;
			settings.pagination == "repeat" ? nextbox(first) : nextpage();
			first = false;
			/* put the content in the box: usually it will overflow */
			jboxes.eq(ibox).empty().append(content);
			for(;;) {
				var jbox = jboxes.eq(ibox);
				var div = jbox.children().get(0); // there is only one - we just put it there
				if (fits(div, jbox.offset().top+jbox.height())) { break; }
				/* Any box to put the divided content into? If not create a new page from the last one */
				nextbox();
				/* move the overflowing content to the next box... */
				divide(div, jboxes.eq(ibox));
			}
			if (settings.pagination == "duplex" && (ipagenumber % 2) != 0) {
				/* duplex requires adding an empty page if we have an odd number so far */
				nextpage();
				jboxes.first().parent().empty();
			}
		});

		jip.remove();

		/* apply page numbers */
		$("."+settings.pagenumber).each(function() {
			var jthis = $(this);
			jthis.text(jthis.closest("["+settings.pagenumber+"]").attr(settings.pagenumber));
		});
		
		return jallpages;
	}
})(jQuery);