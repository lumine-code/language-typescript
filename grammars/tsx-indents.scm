
; JSX
; ===

(jsx_opening_element [">"] @indent)

; Support things like…
; <div
;   className={'foo'}
;   onClick={onClick}
; >
(jsx_opening_element ["<"] @indent
  (#is-not? test.startsOnSameRowAs parent.lastChild.startPosition))
(jsx_opening_element ">" @match
  (#is-not? test.startsOnSameRowAs parent.startPosition)
  (#set! indent.match parent.startPosition))
(jsx_opening_element ">" @match.next
  (#is-not? test.startsOnSameRowAs parent.startPosition)
  (#is? test.lastTextOnRow true)
  (#set! indent.match parent.startPosition)
  (#set! indent.offset 1))

; We match on the whole node here because
; (a) we need to please the dedent-while-typing heuristic, so the line text
;     must match the capture node's text; and
; (b) we don't want the dedent to trigger until the very last `>` has been
;     typed.
(jsx_closing_element ">") @dedent

; Support things like…
; <img
;   height={40}
;   width={40}
;   alt={'foo'}
; />
(jsx_self_closing_element "<" @indent
  (#is-not? test.startsOnSameRowAs parent.lastChild.startPosition))

; Align a delimiter-only row and resume the owner's margin after the tag.
; Inline attributes keep their own continuation indentation while typing.
(jsx_self_closing_element "/>" @match @match.next
  (#is-not? test.startsOnSameRowAs parent.startPosition)
  (#is? test.lastTextOnRow true)
  (#set! indent.match parent.startPosition))
