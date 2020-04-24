import * as fs from 'fs'
import * as path from 'path'
import * as Handlebars from 'handlebars'
import {execSync, spawnSync} from 'child_process'
import * as htmlMinifier from 'html-minifier'
import { minify as minifyJs } from 'terser'
import CleanCss from 'clean-css'
import * as hljs from 'highlight.js'
import cheerio from 'cheerio'

const PARTIALS_DIR = './partials'
const POSTS_DIR = './posts'
const DATA = postsData()

const templates = {
	makePost: Handlebars.compile(fs.readFileSync('./pages/post.hbs', 'utf8')),
	makeIndex: Handlebars.compile(fs.readFileSync('./pages/index.hbs', 'utf8')),
}

fs.mkdirSync('build/assets', { recursive: true })
compileFontCss()
registerPartials()
genPosts(DATA)
genIndex(DATA)

function defaults(post?: PostData) {
	return {
		css: genCss(),
		title: post?.metadata.title ? `${post?.metadata.title} - Frank Filho` : 'Frank Filho'
	}
}

function compileFontCss() {
	const fontData = genFontData()
	const style = Handlebars.compile(fs.readFileSync('assets/fonts.css', 'utf8'))({ fontData })
	fs.writeFileSync('build/assets/fonts.css', minifyCss(style))
}

function minifyCss(css: string) {
	return new CleanCss().minify(css).styles
}

function genFontData() {
	const fontPath = (variation: string) => `assets/crimson-text-${variation}.woff2`
	const genSrc = (base64: string) => `url(data:font/woff2;charset=utf8;base64,${base64}) format('woff2')`
	const variations = ['bold', 'italic', 'regular']
	const data = variations
		.map(fontPath)
		.map(_ => fs.readFileSync(_, 'base64'))
		.map((base64, i) => ({
			name: 'crimson text',
			weight: variations[i] == 'bold' ? 700 : 400,
			src: genSrc(base64),
		}))

	return data
}

function genCss() {
	return fs.readFileSync('assets/style.css') + '\n' +
		fs.readFileSync('assets/atom-one-dark.css')
}

function genIndex(posts: PostData[]) {
	write('index.html', templates.makeIndex({posts, ...defaults()}))
}

function genPosts(posts: PostData[]) {
	const dir = './posts'
	for (const post of posts) {
		write(post.fullpath, templates.makePost({post, ...defaults(post)}))
	}
}

function write(filename: string, content: string) {
	const fullpath = formatFilename(path.join('build', filename))
	const dir = path.parse(fullpath).dir
	fs.mkdirSync(dir, {recursive: true})
	console.log(`Writing to ${fullpath}`)
	fs.writeFileSync(fullpath, optimizeHtml(content), {
		encoding: 'utf8',
		flag: 'w',
	})
}

type PostData = {
	html: string
	filename: string
	fullpath: string
	href: string
	metadata: Metadata
}

function postsData(): PostData[] {
	const data = [] as PostData[]
	for (const filename of fs.readdirSync(POSTS_DIR)) {
		const fullpath = path.join(POSTS_DIR, filename)
		if (!filename.includes('.org')) {
			console.log(`Skipping ${filename}`)
			continue
		}
		const {html, metadata} = compileOrgFile(fullpath)
		let href = formatFilename(fullpath)
		href = path.parse(href).dir
		data.push({
			html,
			filename,
			fullpath,
			metadata,
			href,
		})
	}
	return data
}

function formatFilename(filename: string): string {
	const parsed = path.parse(filename)
	if (parsed.base == 'index.html') {
		return filename
	}
	const newPath = path.join(parsed.dir, parsed.name, 'index.html')
	return newPath
}

type OrgCompilationResult = {
	html: string
	metadata: Metadata
}

function compileOrgFile(path: string): OrgCompilationResult {
	const rawContent = fs.readFileSync(path, 'utf8')
	const separator = '\n---\n'
	const idx = rawContent.indexOf(separator)
	const rawMetadata = rawContent.slice(0, idx)
	const metadata = parseMetadata(rawMetadata)
	const content = rawContent.slice(idx + separator.length, rawContent.length)
	const {stdout} = spawnSync('pandoc', ['--from=org', '--to=html'], {
		input: content,
		encoding: 'utf8',
	})
	return {html: stdout, metadata}
}
type Metadata = {[k: string]: string}

function parseMetadata(str: string): Metadata {
	return str
		.split('\n')
		.map(line => line.split(':'))
		.reduce((data, [key, value]) => {
			return {...data, [key]: value.trim()}
		}, {} as Metadata)
}

function cp(from: string, to: string): void {
	if (fs.readdirSync(from).length == 0) {
		return
	}
	execSync(`mkdir -p ${to}`)
	execSync(`cp ${from}/* ${to}`)
	console.log(`Copied ${from} to ${to}`)
}

function registerPartials() {
	for (const filename of fs.readdirSync(PARTIALS_DIR)) {
		const fullpath = path.join(PARTIALS_DIR, filename)
		const {name} = path.parse(fullpath)
		const content = fs.readFileSync(fullpath, 'utf8')
		Handlebars.registerPartial(name, content)
	}
}

function optimizeHtml(html: string) {
	const opts: htmlMinifier.Options = {
		collapseWhitespace: true,
		html5: true,
		removeComments: true,
		removeTagWhitespace: true,
		removeEmptyAttributes: true,
		removeRedundantAttributes: true,
		removeScriptTypeAttributes: true,
		removeEmptyElements: true,
		removeAttributeQuotes: true,
		minifyCSS: true,
		minifyJS: (text: string) => {
				const res = minifyJs(text, { warnings: true })
				if (res.warnings) console.log(res.warnings)
				if (res.error) {
					console.log(text)
					throw res.error
				}
				return res.code as string
			}
	}
	const highlighted =	 highlightHtml(html)
	return htmlMinifier.minify(highlighted, opts)
}

function highlightHtml(html: string) {
	const $ = cheerio.load(html)
	$('code.sourceCode').each((i, el) => {
		const content = $(el).text()!
		$(el).empty()
		$(el).append(hljs.highlightAuto(content).value)
		$(el).addClass('hljs')
	})
	return $.html()
}
