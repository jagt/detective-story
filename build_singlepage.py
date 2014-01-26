import os
import sys
outfile = sys.argv[1]
with open('detective.html', 'r') as f:
    html = f.read()
    scripts = []
    for script in os.listdir('scripts'):
        with open('scripts/'+script, 'r') as s:
            scripts.append(s.read())

    new = '''
<script type="text/plain" id="gamescripts">
%s
</script>
''' % "\n\n".join(scripts)
    outhtml = html.replace('<!--replaceme-->', new, 1)

    with open(outfile, 'w') as fout:
        fout.write(outhtml)

    print "written to:" + outfile


